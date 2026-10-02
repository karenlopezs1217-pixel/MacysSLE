import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

const REQUEST = '20 minutes, work outfit, size 16, under $150, this store';

async function toSelectedOutfit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Tell me what you need'), REQUEST);
  await user.click(screen.getByRole('button', { name: 'Understand' }));
  await user.click(screen.getByRole('button', { name: 'Find outfits' }));
  await user.click(screen.getAllByRole('button', { name: 'Choose this one' })[0]); // best pick
}

const TITLES: Record<number, string> = { 3: 'See the fit', 4: 'Find it in store', 5: 'Your price and checkout' };
/** Open a step from the stepper (like a shopper would) and return its panel. */
async function visit(user: ReturnType<typeof userEvent.setup>, n: 3 | 4 | 5) {
  await user.click(screen.getByRole('button', { name: new RegExp(`^Step ${n}:`) }));
  return screen.getByRole('region', { name: TITLES[n] });
}

describe('Component 3: virtual try-on (mock)', () => {
  it('is labeled as a mock simulation and shows sample fit notes for every piece of the selected outfit', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toSelectedOutfit(user);
    const tryOn = await visit(user, 3);
    expect(within(tryOn).getAllByText(/mock simulation/i).length).toBeGreaterThan(0);
    expect(within(tryOn).getByRole('img', { name: /Mock simulation:.*Not an accurate picture of fit/ })).toBeInTheDocument();
    // best pick = shell top + pencil skirt + cardigan; pencil skirt runs small -> suggests 18
    expect(within(tryOn).getAllByRole('listitem').filter((li) => li.classList.contains('tryon-piece'))).toHaveLength(3);
    expect(within(tryOn).getByText(/Runs small — size up — we suggest/)).toBeInTheDocument();
    expect(within(tryOn).getByText('Close through the hips; size up for more room.')).toBeInTheDocument();
    expect(within(tryOn).getAllByText(/sample/i).length).toBeGreaterThan(0);
  });

  it('requires explicit consent before any photo upload is possible, and keeps nothing in storage or on the network', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<App />);
    await toSelectedOutfit(user);
    const tryOn = await visit(user, 3);

    expect(tryOn.querySelector('input[type=file]')).toBeNull(); // default avatar: no upload at all
    await user.click(within(tryOn).getByLabelText('My photo (optional)'));
    expect(tryOn.querySelector('input[type=file]')).toBeNull(); // consent still pending
    const cont = within(tryOn).getByRole('button', { name: 'Continue' });
    expect(cont).toBeDisabled();
    const box = within(tryOn).getByRole('checkbox');
    expect(box).not.toBeChecked();
    await user.click(box);
    await user.click(cont);
    const file = tryOn.querySelector('input[type=file]') as HTMLInputElement;
    expect(file).not.toBeNull();
    expect(file.accept).toBe('image/*');
    expect(file.hasAttribute('capture')).toBe(false);

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('declining consent returns to the avatar', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toSelectedOutfit(user);
    const tryOn = await visit(user, 3);
    await user.click(within(tryOn).getByLabelText('My photo (optional)'));
    await user.click(within(tryOn).getByRole('button', { name: 'Use an avatar instead' }));
    expect(within(tryOn).getByLabelText('An avatar (default)')).toBeChecked();
    expect(tryOn.querySelector('input[type=file]')).toBeNull();
  });

  it('the size previewed in try-on carries to the stock step', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toSelectedOutfit(user);
    const stock = await visit(user, 4);
    const sizeSelects = within(stock).getAllByLabelText('Size') as HTMLSelectElement[];
    expect(sizeSelects.map((s) => s.value)).toEqual(['16', '18', '16']);
    expect(within(stock).getAllByText(/from your fit preview/).length).toBeGreaterThan(0);
  });
});

describe('Components 4 and 5: stock, hold, price, handoff', () => {
  it('shows sample stock, floor and department, and offers ship-to-home when a size is unavailable everywhere', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toSelectedOutfit(user);
    const stock = await visit(user, 4);
    expect(within(stock).getByText(/Sample inventory, not verified live stock/)).toBeInTheDocument();
    expect(within(stock).getAllByText(/^Floor \d/).length).toBe(2); // two in-stock pieces show a location
    // the pencil skirt in 18 is out everywhere in the sample data
    expect(within(stock).getByText('Not in this store in size 18')).toBeInTheDocument();
    expect(within(stock).getByText(/Not in stock in size 18 at any sample store/)).toBeInTheDocument();
    expect(within(stock).getByText(/Ship to home/)).toBeInTheDocument();
    // missed demand was logged for the merchant view
    await user.click(screen.getByText(/Merchant view/));
    expect(screen.getByRole('cell', { name: 'size-out-of-stock' })).toBeInTheDocument();
  });

  it('places a SIMULATED fitting-room hold that can be cancelled and never claims a real reservation', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toSelectedOutfit(user);
    const stock = await visit(user, 4);
    await user.click(within(stock).getAllByRole('button', { name: 'Hold in fitting room' })[0]);
    expect(within(stock).getByText('Simulation')).toBeInTheDocument();
    expect(within(stock).getByText(/Not a real reservation/)).toBeInTheDocument();
    await user.click(within(stock).getByRole('button', { name: 'Cancel hold' }));
    expect(within(stock).queryByText('Simulation')).not.toBeInTheDocument();
  });

  it('computes one "You pay" total using only the best valid sample offer, with an expandable breakdown', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toSelectedOutfit(user);
    const price = await visit(user, 5);
    // $131 subtotal; sample weekend offer O1 = 20% of tops/bottoms ($79) = $15.80, beats the $15 offer
    expect(within(price).getByText('$115.20', { selector: '.stock-price-handoff__you-pay' })).toBeInTheDocument();
    const toggle = within(price).getByRole('button', { name: 'See price breakdown' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(price).getByText(/Sample weekend offer: 20% off tops, bottoms and dresses/)).toBeInTheDocument();
    expect(within(price).getByText(/Requires sign-in/)).toBeInTheDocument();
    expect(within(price).getByText(/Expired Sep 30|Not valid on/)).toBeInTheDocument();
    expect(within(price).getByText(/not included. It is calculated at payment/)).toBeInTheDocument();
  });

  it('simulated ship-to-home handoff labels dates and confirmation as samples, then finishes', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toSelectedOutfit(user);
    const price = await visit(user, 5);
    // not everything is in stock here / at any store in the suggested sizes, so pay-here and pickup are blocked
    expect(within(price).getByLabelText(/Pay here and take it now/)).toBeDisabled();
    expect(within(price).getByLabelText(/Pick up in store/)).toBeDisabled();
    await user.click(within(price).getByLabelText(/Ship to home/));
    expect(within(price).getByText(/Sample estimate: arrives Wed, Oct 7/)).toBeInTheDocument();
    await user.click(within(price).getByRole('button', { name: 'Place sample shipping order (simulated)' }));
    expect(within(price).getByText(/Mock confirmation/)).toBeInTheDocument();
    expect(within(price).getByText(/No order was placed/)).toBeInTheDocument();
    await user.click(within(price).getByRole('button', { name: 'Finish' }));
    expect(screen.getByRole('heading', { name: /You're all set/ })).toBeVisible();
    expect(screen.getByText(/Nothing was paid, reserved or shipped/)).toBeInTheDocument();
    expect(screen.getByText('$115.20', { selector: '.done-total strong' })).toBeInTheDocument();
    expect(screen.getByText(/Ship to home at Downtown Flagship/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start a new session' }));
    expect(screen.getByRole('heading', { name: 'What do you need today?' })).toBeVisible();
  });

  it('switching to a size that is in stock unlocks pickup and pay-here, and resets any earlier handoff', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toSelectedOutfit(user);
    let price = await visit(user, 5);
    await user.click(within(price).getByLabelText(/Ship to home/));
    await user.click(within(price).getByRole('button', { name: 'Place sample shipping order (simulated)' }));
    expect(within(price).getByText(/Mock confirmation/)).toBeInTheDocument();

    const stock = await visit(user, 4);
    const skirtSize = within(stock).getAllByLabelText('Size')[1] as HTMLSelectElement;
    await user.selectOptions(skirtSize, '16');
    price = await visit(user, 5);
    // handoff starts over and the options now reflect real (sample) availability
    expect(within(price).queryByText(/Mock confirmation/)).not.toBeInTheDocument();
    expect(within(price).getByLabelText(/Pay here and take it now/)).toBeEnabled();
    expect(within(price).getByLabelText(/Pick up in store/)).toBeEnabled();
  });

  it('choosing a different outfit resets holds, sizes and handoff', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toSelectedOutfit(user);
    const stock = await visit(user, 4);
    await user.click(within(stock).getAllByRole('button', { name: 'Hold in fitting room' })[0]);
    expect(within(stock).getByText('Simulation')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Step 2:/ }));
    await user.click(screen.getAllByRole('button', { name: 'Choose this one' })[1]);
    expect(within(await visit(user, 4)).queryByText('Simulation')).not.toBeInTheDocument();
  });
});
