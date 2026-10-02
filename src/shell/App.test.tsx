import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
});

const field = (name: RegExp) => screen.getByLabelText(name) as HTMLInputElement | HTMLSelectElement;

async function typeRequest(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByLabelText('Tell me what you need'), text);
  await user.click(screen.getByRole('button', { name: 'Understand' }));
}

describe('Component 1: time-and-need intake', () => {
  it('fills editable fields from the canonical request, resolving "this store" from the selected store', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText(/Shopping at/), 'store-lakeside');
    await typeRequest(user, '20 minutes, work outfit, size 16, under $150, this store');

    expect(field(/Time available/).value).toBe('20');
    expect(field(/^Occasion/).value).toBe('work');
    expect(field(/^Size/).value).toBe('16');
    expect(field(/Total budget/).value).toBe('150');
    expect(field(/^Store$/).value).toBe('store-lakeside');
    expect(screen.queryByText(/Quick question/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Find outfits' })).toBeEnabled();

    // Fields stay editable.
    await user.clear(field(/Total budget/));
    await user.type(field(/Total budget/), '175');
    expect(field(/Total budget/).value).toBe('175');
  });

  it('asks exactly ONE grouped question, never assumes size/budget, and blocks recommendations until complete', async () => {
    const user = userEvent.setup();
    render(<App />);
    await typeRequest(user, 'work outfit, this store');

    const questions = screen.getAllByText(/Quick question/);
    expect(questions).toHaveLength(1);
    expect(questions[0].textContent).toMatch(/your size.*your total budget.*how much time/);
    expect(field(/^Size/).value).toBe('');
    expect(field(/Total budget/).value).toBe('');
    expect(screen.getByRole('button', { name: 'Find outfits' })).toBeDisabled();

    // Answering fills only what was given; the question is not repeated.
    await user.type(screen.getByLabelText('Your answer'), 'size 16');
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    expect(screen.queryByText(/Quick question/)).not.toBeInTheDocument();
    expect(field(/^Size/).value).toBe('16');
    expect(screen.getByText(/Still needed: total budget and time/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Find outfits' })).toBeDisabled();

    // A second free-text attempt doesn't trigger another question either.
    await user.type(screen.getByLabelText('Tell me what you need'), ' hmm');
    await user.click(screen.getByRole('button', { name: 'Understand' }));
    expect(screen.queryByText(/Quick question/)).not.toBeInTheDocument();

    // The shopper completes the fields manually.
    await user.type(field(/Total budget/), '120');
    await user.type(field(/Time available/), '25');
    expect(screen.getByRole('button', { name: 'Find outfits' })).toBeEnabled();
  });

  it('shows a text-only experience when voice input is unavailable', () => {
    render(<App />);
    expect(screen.queryByRole('button', { name: /speak/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Voice input is not available/)).toBeInTheDocument();
  });

  it('uses voice input when available, and falls back gracefully on error', async () => {
    const user = userEvent.setup();
    let instance: any;
    class FakeRecognition {
      onresult: any;
      onerror: any;
      onend: any;
      constructor() {
        instance = this;
      }
      start() {}
      stop() {
        this.onend?.();
      }
    }
    (window as any).webkitSpeechRecognition = FakeRecognition;
    render(<App />);

    const speak = screen.getByRole('button', { name: 'Speak' });
    await user.click(speak);
    expect(screen.getByRole('button', { name: 'Stop listening' })).toHaveAttribute('aria-pressed', 'true');
    const { act } = await import('@testing-library/react');
    act(() => {
      instance.onresult({ results: [[{ transcript: '15 minutes casual size M $90 this store' }]] });
      instance.onend();
    });
    expect(field(/^Size/).value).toBe('M');
    expect(field(/Total budget/).value).toBe('90');
    expect(field(/^Occasion/).value).toBe('casual');

    await user.click(screen.getByRole('button', { name: 'Speak' }));
    act(() => {
      instance.onerror({ error: 'not-allowed' });
      instance.onend();
    });
    expect(screen.getByText(/Microphone access was blocked.*type your request instead/)).toBeInTheDocument();
  });
});

describe('Component 2: curated shortlist (via the shell)', () => {
  async function findOutfits(user: ReturnType<typeof userEvent.setup>, text: string) {
    await typeRequest(user, text);
    await user.click(screen.getByRole('button', { name: 'Find outfits' }));
  }

  it('shows at most three options, one Best pick with a recommendation line, and per-piece details', async () => {
    const user = userEvent.setup();
    render(<App />);
    await findOutfits(user, '20 minutes, work outfit, size 16, under $150, this store');

    const cards = screen.getAllByRole('listitem').filter((li) => li.classList.contains('sl-card'));
    expect(cards).toHaveLength(3);
    expect(screen.getAllByText('Best pick')).toHaveLength(1);
    expect(screen.getByText(/^Our pick:/)).toBeInTheDocument();
    for (const card of cards) {
      expect(within(card).getAllByRole('img').length).toBeGreaterThan(0);
      expect(within(card).getAllByText(/Size 16 ·/).length).toBeGreaterThan(0);
      expect(within(card).getByText(/Outfit total/)).toBeInTheDocument();
      expect(within(card).getByText(/size 16 at Downtown Flagship/)).toBeInTheDocument();
    }
  });

  it('"Swap this piece" works, recalculates the total and keeps the outfit within budget', async () => {
    const user = userEvent.setup();
    render(<App />);
    await findOutfits(user, '20 minutes, work outfit, size 16, under $150, this store');

    const card = screen.getAllByRole('listitem').find((li) => li.classList.contains('sl-card--best'))!;
    const totalBefore = within(card).getByText(/^\$\d+\.\d{2}$/, { selector: 'strong' }).textContent!;
    const namesBefore = Array.from(card.querySelectorAll('.sl-piece-name')).map((n) => n.textContent);
    const swapButtons = within(card).getAllByRole('button', { name: /^Swap this piece:/ });
    const enabled = swapButtons.find((b) => !(b as HTMLButtonElement).disabled)!;
    await user.click(enabled);

    const namesAfter = Array.from(card.querySelectorAll('.sl-piece-name')).map((n) => n.textContent);
    expect(namesAfter).not.toEqual(namesBefore);
    expect(namesAfter).toHaveLength(namesBefore.length);
    const totalAfter = within(card).getByText(/^\$\d+\.\d{2}$/, { selector: 'strong' }).textContent!;
    expect(totalAfter).not.toBe(totalBefore);
    expect(Number(totalAfter.slice(1))).toBeLessThanOrEqual(150);
    // The sum of the displayed piece prices matches the displayed total.
    const prices = Array.from(card.querySelectorAll('.sl-piece-meta')).map((m) => Number(/\$(\d+\.\d{2})/.exec(m.textContent!)![1]));
    expect(prices.reduce((a, b) => a + b, 0)).toBeCloseTo(Number(totalAfter.slice(1)), 2);
    expect(screen.getByText(/^Swapped .* for .*New total/, { selector: '[role=status]' })).toBeInTheDocument();
  });

  it('shows fewer than three options when fewer qualify', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText(/Shopping at/), 'store-westgate');
    await findOutfits(user, '20 minutes, work, size 16, under $150, this store');
    const cards = screen.getAllByRole('listitem').filter((li) => li.classList.contains('sl-card'));
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThan(3);
    expect(screen.getByText(/options qualify/)).toBeInTheDocument();
  });

  it('explains an empty result without inventing products or relaxing constraints', async () => {
    const user = userEvent.setup();
    render(<App />);
    await findOutfits(user, '20 minutes, work, size 16, under $10, this store');
    expect(screen.queryAllByRole('listitem').filter((li) => li.classList.contains('sl-card'))).toHaveLength(0);
    expect(screen.getByText(/costs more than your \$10\.00 budget/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing has been substituted or loosened/)).toBeInTheDocument();
  });

  it('explains a size with no stock', async () => {
    const user = userEvent.setup();
    render(<App />);
    await findOutfits(user, '20 minutes, work, size 2, $200, this store');
    expect(screen.getByText(/Nothing is in stock in size 2 at Downtown Flagship/)).toBeInTheDocument();
  });

  it('choosing an outfit advances to the fit step and unlocks later steps; editing inputs clears the shortlist', async () => {
    const user = userEvent.setup();
    render(<App />);
    const step = (n: number) => screen.getByRole('button', { name: new RegExp(`^Step ${n}:`) });
    for (const n of [2, 3, 4, 5]) expect(step(n)).toBeDisabled();

    await findOutfits(user, '20 minutes, work outfit, size 16, under $150, this store');
    expect(screen.getByRole('heading', { name: 'Your top picks' })).toBeVisible(); // auto-advanced
    expect(step(2)).toBeEnabled();
    expect(step(3)).toBeDisabled();

    await user.click(screen.getAllByRole('button', { name: 'Choose this one' })[0]);
    expect(screen.getByRole('heading', { name: 'See the fit' })).toBeVisible(); // auto-advanced
    for (const n of [2, 3, 4, 5]) expect(step(n)).toBeEnabled();
    expect(screen.getByRole('heading', { name: /Size and fit notes/ })).toBeInTheDocument();
    expect(screen.getByText(/^Selected:/)).toBeInTheDocument();

    await user.click(step(1));
    await user.clear(field(/Total budget/));
    await user.type(field(/Total budget/), '120');
    expect(screen.getByText(/Your details changed, so the old options were cleared/)).toBeInTheDocument();
    for (const n of [2, 3, 4, 5]) expect(step(n)).toBeDisabled();
  });

  it('the guided flow can be walked with Back and Continue buttons', async () => {
    const user = userEvent.setup();
    render(<App />);
    await findOutfits(user, '20 minutes, work outfit, size 16, under $150, this store');
    expect(screen.getByRole('button', { name: /Continue with selected outfit/ })).toBeDisabled();
    await user.click(screen.getAllByRole('button', { name: 'Choose this one' })[0]);
    await user.click(screen.getByRole('button', { name: /Continue to stock/ }));
    expect(screen.getByRole('heading', { name: 'Find it in store' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Continue to price/ }));
    expect(screen.getByRole('heading', { name: 'Your price and checkout' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Back to stock/ }));
    await user.click(screen.getByRole('button', { name: /Back to fit/ }));
    await user.click(screen.getByRole('button', { name: /Back to options/ }));
    expect(screen.getByRole('heading', { name: 'Your top picks' })).toBeVisible();
    expect(screen.getByText('Selected', { selector: '.sl-badge' })).toBeInTheDocument(); // selection survives going back
  });

  it('example chips fill the request in one tap', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Casual, size M' }));
    expect(field(/^Size/).value).toBe('M');
    expect(field(/^Occasion/).value).toBe('casual');
    expect(screen.getByRole('button', { name: 'Find outfits' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Find outfits' })).toHaveFocus(); // next action is ready
  });

  it('moves focus to the one clarifying question when details are missing', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Wedding guest (missing details)' }));
    expect(screen.getByLabelText('Your answer')).toHaveFocus();
    expect(screen.getAllByText(/Quick question/)).toHaveLength(1);
  });

  it('End session resets everything', async () => {
    const user = userEvent.setup();
    render(<App />);
    await findOutfits(user, '20 minutes, work outfit, size 16, under $150, this store');
    await user.click(screen.getByRole('button', { name: 'End session' }));
    expect(field(/^Size/).value).toBe('');
    expect(screen.getByRole('heading', { name: 'What do you need today?' })).toBeVisible();
    expect(screen.getByRole('button', { name: /^Step 2:/ })).toBeDisabled();
  });
});
