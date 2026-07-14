import ChallengeFrame from '@/challenges/shared/ChallengeFrame';
import AnswerBox from '@/challenges/shared/AnswerBox';

const ID = 'd7_markup_trail';

export default function MarkupTrailChallenge() {
  return (
    <ChallengeFrame
      challengeId={ID}
      title="Markup Trail"
      blurb="This help desk page looks empty on purpose. The recovery is already on the page — just not in the text you can read with your eyes. Dig through the structure of what the browser actually built."
    >
      <div className="mt-4 space-y-3 rounded-lg border border-terminal-border bg-terminal-input/30 p-4 text-sm text-terminal-dim">
        <p>Welcome to the front desk.</p>
        <p data-slot="a">Tickets open 09:00–17:00.</p>
        <p>
          Please take a number. <span data-slot="b">Priority lanes are closed.</span>
        </p>
        {/* ow */}
        <p className="opacity-60">Staff will call you shortly.</p>
        <ul className="list-disc pl-5 text-xs">
          <li data-slot="c">Keep your ticket visible.</li>
          <li data-pad="xx">Do not leave bags unattended.</li>
        </ul>
        <i data-k="ink" className="hidden" />
        <i data-k="_bel" className="hidden" />
      </div>
      <AnswerBox challengeId={ID} />
    </ChallengeFrame>
  );
}
