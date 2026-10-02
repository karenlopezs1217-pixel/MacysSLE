import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CompleteShopperRequest, Occasion, ShopperRequest, Store } from '../../shared/types';
import { EMPTY_REQUEST, missingFields, isRequestComplete, type EssentialField } from '../../shared/session';
import { OCCASIONS, PRODUCTS, STORES } from '../../shared/sampleData';
import { buildClarifyingQuestion, joinList, parseShopperText, type ParseResult } from './parseRequest';
import { describeVoiceError, getSpeechRecognition, type SpeechRecognitionLike } from './voice';
import './intake.css';

export interface TimeAndNeedIntakeProps {
  /** Current request from the shell's session state (controlled). */
  request: ShopperRequest;
  /** Called with the full next request whenever text is understood or a field is edited. */
  onRequestChange: (next: ShopperRequest) => void;
  /** Called when the shopper presses "Find outfits" with a COMPLETE request. */
  onSubmit: (request: CompleteShopperRequest) => void;
  stores?: Store[];
  occasions?: Occasion[];
  /** Suggestions for the size field. Defaults to every size in the sample catalog. */
  knownSizes?: string[];
}

const DEFAULT_SIZES = Array.from(new Set(PRODUCTS.flatMap((p) => p.availableSizes))).sort((a, b) => {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  if (!Number.isNaN(na)) return -1;
  if (!Number.isNaN(nb)) return 1;
  const order = ['XS', 'S', 'M', 'L', 'XL'];
  return order.indexOf(a) - order.indexOf(b);
});

const FIELD_LABELS: Record<EssentialField, string> = {
  occasion: 'occasion',
  size: 'size',
  budget: 'total budget',
  timeMinutes: 'time',
  storeId: 'store',
};

const EXAMPLE = '20 minutes, work outfit, size 16, under $150, this store';

export function TimeAndNeedIntake({
  request,
  onRequestChange,
  onSubmit,
  stores = STORES,
  occasions = OCCASIONS,
  knownSizes = DEFAULT_SIZES,
}: TimeAndNeedIntakeProps) {
  const uid = useId();
  const [text, setText] = useState('');
  const [reply, setReply] = useState('');
  const [question, setQuestion] = useState<string | null>(null);
  const [questionAnswered, setQuestionAnswered] = useState(false);
  const [understood, setUnderstood] = useState<string | null>(null);
  const [parsedOnce, setParsedOnce] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // At most ONE clarifying question per intake; a ref avoids stale closures from voice callbacks.
  const questionAskedRef = useRef(false);

  const voiceSupported = useMemo(() => getSpeechRecognition() !== null, []);
  const missing = missingFields(request);
  const complete = missing.length === 0;
  const showInvalid = parsedOnce;
  const questionCardVisible = question !== null && !questionAnswered && !complete;

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? id;
  const occasionLabel = (id: string) => occasions.find((o) => o.id === id)?.label ?? id;

  function describeUnderstood(parsed: ParseResult): string {
    const f = parsed.fields;
    const bits: string[] = [];
    if (f.timeMinutes != null) bits.push(`${f.timeMinutes} min`);
    if (f.occasion) bits.push(occasionLabel(f.occasion));
    if (f.size) bits.push(`size ${f.size}`);
    if (f.budget != null) bits.push(`$${f.budget} total budget`);
    if (f.storeId) bits.push(storeName(f.storeId));
    return bits.length ? `I understood: ${bits.join(' · ')}.` : "I couldn't pick out any details from that.";
  }

  function interpret(input: string, source: 'text' | 'reply') {
    if (!input.trim()) return;
    const parsed = parseShopperText(input, { stores, occasions, selectedStoreId: request.storeId });
    const next: ShopperRequest = { ...request, ...parsed.fields };
    onRequestChange(next);
    setParsedOnce(true);
    setUnderstood(describeUnderstood(parsed));

    const stillMissing = missingFields(next);
    if (source === 'reply') setQuestionAnswered(true);
    if (stillMissing.length > 0 && !questionAskedRef.current) {
      questionAskedRef.current = true;
      setQuestion(
        buildClarifyingQuestion(stillMissing, parsed, { occasion: occasionLabel, store: storeName }),
      );
    }
  }

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    setVoiceMessage(null);
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(' ')
        .trim();
      if (transcript) {
        setText(transcript);
        interpret(transcript, 'text');
      }
    };
    rec.onerror = (e) => setVoiceMessage(`${describeVoiceError(e.error)} You can type your request instead.`);
    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setVoiceMessage('Voice input could not start. You can type your request instead.');
    }
  }

  function patch(partial: Partial<ShopperRequest>) {
    onRequestChange({ ...request, ...partial });
  }

  function startOver() {
    recognitionRef.current?.stop();
    questionAskedRef.current = false;
    setText('');
    setReply('');
    setQuestion(null);
    setQuestionAnswered(false);
    setUnderstood(null);
    setParsedOnce(false);
    setVoiceMessage(null);
    // Keep the shell's selected store; everything else is forgotten.
    onRequestChange({ ...EMPTY_REQUEST, storeId: request.storeId });
  }

  const ids = {
    text: `${uid}-text`,
    reply: `${uid}-reply`,
    occasion: `${uid}-occasion`,
    size: `${uid}-size`,
    budget: `${uid}-budget`,
    time: `${uid}-time`,
    store: `${uid}-store`,
    sizes: `${uid}-sizes`,
    hint: `${uid}-hint`,
  };

  const invalid = (f: EssentialField) => showInvalid && missing.includes(f);
  const fieldClass = (f: EssentialField) => `ti-field${invalid(f) ? ' ti-field--needed' : ''}`;

  return (
    <div className="ti">
      <form
        className="ti-nl"
        onSubmit={(e) => {
          e.preventDefault();
          interpret(text, 'text');
        }}
      >
        <label htmlFor={ids.text} className="ti-label">
          Tell me what you need
        </label>
        <div className="ti-nl-row">
          <input
            id={ids.text}
            className="ti-input"
            type="text"
            value={text}
            placeholder={`e.g. ${EXAMPLE}`}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
          />
          {voiceSupported && (
            <button
              type="button"
              className={`btn btn--secondary ti-voice${listening ? ' ti-voice--on' : ''}`}
              aria-pressed={listening}
              onClick={toggleVoice}
            >
              {listening ? 'Stop listening' : 'Speak'}
            </button>
          )}
          <button type="submit" className="btn btn--primary" disabled={!text.trim()}>
            Understand
          </button>
        </div>
        <p className="ti-help">
          {voiceSupported
            ? "Type or tap Speak. Voice uses your browser's speech service."
            : 'Voice input is not available in this browser — typing works the same way.'}
        </p>
        {voiceMessage && (
          <p className="ti-notice ti-notice--warn" role="status">
            {voiceMessage}
          </p>
        )}
      </form>

      <div aria-live="polite" className="ti-feedback">
        {understood && <p className="ti-understood">{understood}</p>}

        {questionCardVisible && (
          <div className="ti-question">
            <p className="ti-question-text">{question}</p>
            <form
              className="ti-nl-row"
              onSubmit={(e) => {
                e.preventDefault();
                interpret(reply, 'reply');
                setReply('');
              }}
            >
              <label htmlFor={ids.reply} className="visually-hidden">
                Your answer
              </label>
              <input
                id={ids.reply}
                className="ti-input"
                type="text"
                value={reply}
                placeholder="e.g. size 16, $150 total"
                onChange={(e) => setReply(e.target.value)}
                autoComplete="off"
              />
              <button type="submit" className="btn btn--secondary" disabled={!reply.trim()}>
                Answer
              </button>
            </form>
            <p className="ti-help">Or just fill in the fields below.</p>
          </div>
        )}

        {parsedOnce && !complete && !questionCardVisible && (
          <p className="ti-notice" role="status">
            Still needed: {joinList(missing.map((f) => FIELD_LABELS[f]))}. Please complete the highlighted fields — I
            won't guess.
          </p>
        )}
      </div>

      <fieldset className="ti-fields">
        <legend className="ti-legend">Your details (editable)</legend>

        <div className={fieldClass('timeMinutes')}>
          <label htmlFor={ids.time}>Time available (minutes)</label>
          <input
            id={ids.time}
            className="ti-input"
            type="number"
            min={1}
            max={480}
            inputMode="numeric"
            value={request.timeMinutes ?? ''}
            aria-invalid={invalid('timeMinutes')}
            onChange={(e) => patch({ timeMinutes: e.target.value === '' ? null : Number(e.target.value) })}
          />
          {invalid('timeMinutes') && <span className="ti-needed">Needed</span>}
        </div>

        <div className={fieldClass('occasion')}>
          <label htmlFor={ids.occasion}>Occasion</label>
          <select
            id={ids.occasion}
            className="ti-input"
            value={request.occasion ?? ''}
            aria-invalid={invalid('occasion')}
            onChange={(e) => patch({ occasion: e.target.value || null })}
          >
            <option value="">Select an occasion…</option>
            {occasions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          {invalid('occasion') && <span className="ti-needed">Needed</span>}
        </div>

        <div className={fieldClass('size')}>
          <label htmlFor={ids.size}>Size</label>
          <input
            id={ids.size}
            className="ti-input"
            type="text"
            list={ids.sizes}
            value={request.size ?? ''}
            placeholder="e.g. 16 or M"
            aria-invalid={invalid('size')}
            onChange={(e) => patch({ size: e.target.value.trim() === '' ? null : e.target.value.toUpperCase() })}
            autoComplete="off"
          />
          <datalist id={ids.sizes}>
            {knownSizes.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          {invalid('size') && <span className="ti-needed">Needed</span>}
        </div>

        <div className={fieldClass('budget')}>
          <label htmlFor={ids.budget}>Total budget ($, whole outfit)</label>
          <input
            id={ids.budget}
            className="ti-input"
            type="number"
            min={1}
            step="any"
            inputMode="decimal"
            value={request.budget ?? ''}
            aria-invalid={invalid('budget')}
            onChange={(e) => patch({ budget: e.target.value === '' ? null : Number(e.target.value) })}
          />
          {invalid('budget') && <span className="ti-needed">Needed</span>}
        </div>

        <div className={fieldClass('storeId')}>
          <label htmlFor={ids.store}>Store</label>
          <select
            id={ids.store}
            className="ti-input"
            value={request.storeId ?? ''}
            aria-invalid={invalid('storeId')}
            onChange={(e) => patch({ storeId: e.target.value || null })}
          >
            <option value="">Select a store…</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {invalid('storeId') && <span className="ti-needed">Needed</span>}
        </div>
      </fieldset>

      <div className="ti-actions">
        <button
          type="button"
          className="btn btn--primary"
          disabled={!complete}
          aria-describedby={ids.hint}
          onClick={() => isRequestComplete(request) && onSubmit(request)}
        >
          Find outfits
        </button>
        <button type="button" className="btn btn--ghost" onClick={startOver}>
          Start over
        </button>
        <p id={ids.hint} className="ti-help">
          {complete
            ? 'Everything is filled in. Edit anything above, then find outfits.'
            : `Complete ${joinList(missing.map((f) => FIELD_LABELS[f]))} to see recommendations.`}
        </p>
      </div>
    </div>
  );
}
