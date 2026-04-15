import AppHeader from "@/components/AppHeader";
import MarkdownHtml from "@/components/MarkdownHtml";
import PublicHeader from "@/components/PublicHeader";
import { getApiUserContext } from "@/lib/server/authz";

const PRIZES_MARKDOWN = `
# Prize Pool

The AI Misinformation Resilience Challenge rewards the top contributors based on final leaderboard points.

## Prize Breakdown

1. **1st Place** — **$500**
2. **2nd Place** — **$250**
3. **3rd Place** — **$100**

## How Winners Are Determined

- Rankings are based on the total points shown on the leaderboard.
- Points come from scored responses in valid challenge interactions.
- Higher final points mean a higher placement.

## Important Notes

- The leaderboard remains public so participants can track progress.
- Duplicate or low-value attempts may not increase score.
- Final standings are locked at the event cutoff time announced by organizers.

## Fair Play Reminder

This challenge is designed to test persuasion robustness in a controlled environment.  
Please focus on meaningful, relevant attempts and respect event rules.

## Tie Handling

If participants finish with the same score, organizers may apply tie-break logic such as:

- earliest time reaching that score
- quality/relevance review of top attempts
- or another published event policy

## Final Announcement

Winners and payout instructions will be shared by the ICONIP 2026 CTF organizers after result verification.
`;

export default async function PrizesPage() {
  const { userId, profile } = await getApiUserContext();

  return (
    <main className="flex flex-1">
      <div className="cyber-page-shell">
        {userId ? (
          <AppHeader profile={profile} active="prizes" title="Prizes" />
        ) : (
          <PublicHeader active="prizes" />
        )}

        <section className="cyber-page-content !mt-16">
          <MarkdownHtml
            markdown={PRIZES_MARKDOWN}
            className="prose prose-slate mx-auto max-w-4xl prose-headings:font-display prose-headings:text-[var(--accent)] prose-p:text-[var(--foreground)] prose-strong:text-[var(--foreground)] prose-ul:text-[var(--foreground)] prose-ol:text-[var(--foreground)] prose-li:text-[var(--foreground)] prose-li:marker:text-[var(--accent-light)] prose-blockquote:border-l-[var(--accent-secondary)] prose-blockquote:text-[var(--accent)] prose-hr:border-[rgba(21,40,82,0.22)]"
          />
        </section>
      </div>
    </main>
  );
}

