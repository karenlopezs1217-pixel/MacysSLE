import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../shell/App';

// A no-op 2D context so the component can "draw" in jsdom.
const noop: any = new Proxy(function () {}, { get: () => noop, apply: () => noop });
const ctxStub = new Proxy({}, { get: (_t, prop) => (prop === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => undefined) });

let photoCanvases: HTMLCanvasElement[] = [];
const realCreate = document.createElement.bind(document);

beforeEach(() => {
  photoCanvases = [];
  HTMLCanvasElement.prototype.getContext = (() => ctxStub) as any;
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string, opts?: any) => {
    const el = realCreate(tag, opts);
    if (tag === 'canvas') photoCanvases.push(el as HTMLCanvasElement);
    return el;
  }) as any);
  (URL as any).createObjectURL = vi.fn(() => 'blob:fake');
  (URL as any).revokeObjectURL = vi.fn();
  // Images "load" immediately with a size.
  (globalThis as any).Image = class {
    naturalWidth = 400;
    naturalHeight = 600;
    complete = true;
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    set src(v: string) {
      if (v) queueMicrotask(() => this.onload?.());
    }
  };
});
afterEach(() => vi.restoreAllMocks());

async function openTryOn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Tell me what you need'), '20 minutes, work outfit, size 16, under $150, this store');
  await user.click(screen.getByRole('button', { name: 'Understand' }));
  await user.click(screen.getByRole('button', { name: 'Find outfits' }));
  await user.click(screen.getAllByRole('button', { name: 'Choose this one' })[0]);
  return screen.getByRole('region', { name: 'See the fit' }); // choosing an outfit opens the fit step
}

/** Uploads a photo and returns the in-memory canvas the component created for it. */
async function uploadPhoto(user: ReturnType<typeof userEvent.setup>, tryOn: HTMLElement): Promise<HTMLCanvasElement> {
  const before = photoCanvases.length;
  await user.click(within(tryOn).getByLabelText('My photo (optional)'));
  await user.click(within(tryOn).getByRole('checkbox'));
  await user.click(within(tryOn).getByRole('button', { name: 'Continue' }));
  const input = tryOn.querySelector('input[type=file]') as HTMLInputElement;
  await user.upload(input, new File(['x'], 'me.png', { type: 'image/png' }));
  await waitFor(() => expect(within(tryOn).getByRole('button', { name: 'Delete photo now' })).toBeInTheDocument());
  const created = photoCanvases.slice(before);
  expect(created).toHaveLength(1); // exactly one in-memory canvas, never attached to the page
  expect(created[0].isConnected).toBe(false);
  return created[0];
}

describe('try-on photo privacy', () => {
  it('holds the photo in memory only, and "Delete photo now" erases it', async () => {
    const user = userEvent.setup();
    render(<App />);
    const tryOn = await openTryOn(user);
    const photo = await uploadPhoto(user, tryOn);
    expect(photo.width).toBe(900);
    expect(within(tryOn).getByText(/Held in this page's memory only/)).toBeInTheDocument();
    expect(localStorage.length + sessionStorage.length).toBe(0);

    await user.click(within(tryOn).getByRole('button', { name: 'Delete photo now' }));
    expect(photo.width).toBe(0);
    expect(within(tryOn).queryByRole('button', { name: 'Delete photo now' })).not.toBeInTheDocument();
  });

  it('ending the session erases the photo, and the next session asks for consent again', async () => {
    const user = userEvent.setup();
    render(<App />);
    const tryOn = await openTryOn(user);
    const canvas = await uploadPhoto(user, tryOn);
    expect(canvas.width).toBe(900);

    await user.click(screen.getByRole('button', { name: 'End session' }));
    expect(canvas.width).toBe(0); // wiped on unmount
    expect(screen.getByRole('button', { name: /^Step 3:/ })).toBeDisabled();

    // A new session starts from scratch: the shopper must consent again.
    await user.type(screen.getByLabelText('Tell me what you need'), '20 minutes, work outfit, size 16, under $150, this store');
    await user.click(screen.getByRole('button', { name: 'Understand' }));
    await user.click(screen.getByRole('button', { name: 'Find outfits' }));
    await user.click(screen.getAllByRole('button', { name: 'Choose this one' })[0]);
    const again = screen.getByRole('region', { name: 'See the fit' });
    await user.click(within(again).getByLabelText('My photo (optional)'));
    expect(within(again).getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(again.querySelector('input[type=file]')).toBeNull();
  });

  it('never reads a file when consent has not been given', async () => {
    const user = userEvent.setup();
    render(<App />);
    const tryOn = await openTryOn(user);
    expect(tryOn.querySelector('input[type=file]')).toBeNull();
    expect((URL as any).createObjectURL).not.toHaveBeenCalled();
    act(() => undefined);
  });
});
