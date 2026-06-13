#!/usr/bin/env node
// At-a-glance ops dashboard — the DB side of the funnel (Plausible covers the
// top). Read-only, no web endpoint, no auth surface: you run it over SSH, which
// your SSH key already protects. Complements Plausible (traffic) with the truth
// (signups, confirms, referrals, votes).
//
//   ssh root@oddlympics.app 'cd /opt/oddlympics && sudo -u oddlympics node scripts/dashboard.mjs'
//   (or locally:  node scripts/dashboard.mjs)

import Database from 'better-sqlite3';
import { resolve } from 'node:path';

const DB_PATH = resolve(process.env.DATABASE_PATH ?? './data/oddlympics.db');
const db = new Database(DB_PATH, { readonly: true });
const one = (sql, ...a) => db.prepare(sql).get(...a);
const all = (sql, ...a) => db.prepare(sql).all(...a);
const rule = (s) => console.log('\n\x1b[1m' + s + '\x1b[0m');

console.log(`\noddlympics — ${new Date().toISOString().replace('T', ' ').slice(0, 16)}Z   (${DB_PATH})`);

rule('FUNNEL');
const f = one(`SELECT COUNT(*) total,
  SUM(confirmed_at IS NOT NULL) confirmed,
  SUM(unsubscribed_at IS NOT NULL) unsubscribed,
  SUM(created_at > strftime('%s','now')-86400) last_24h,
  SUM(created_at > strftime('%s','now')-604800) last_7d
  FROM vip_signups`);
const rate = f.total ? Math.round((100 * f.confirmed) / f.total) : 0;
console.log(`  signups: ${f.total}   confirmed: ${f.confirmed} (${rate}%)   unsubscribed: ${f.unsubscribed}`);
console.log(`  new — last 24h: ${f.last_24h}   last 7d: ${f.last_7d}`);

rule('KICKOFF EMAILS (sent receipts)');
const n = one(`SELECT COUNT(*) total,
  SUM(sent_at > strftime('%s','now')-86400) last_24h, MAX(sent_at) last
  FROM match_notifications`);
console.log(`  total sent: ${n.total}   last 24h: ${n.last_24h}   last send: ${n.last ? new Date(n.last*1000).toISOString().replace('T',' ').slice(0,16)+'Z' : 'never'}`);
const sent = all(`SELECT datetime(nt.sent_at,'unixepoch') sent_utc, nt.user_email,
  h.tla||' v '||a.tla AS match
  FROM match_notifications nt
  JOIN matches m ON m.id=nt.match_id
  JOIN teams h ON m.home_team_id=h.id JOIN teams a ON m.away_team_id=a.id
  ORDER BY nt.sent_at DESC LIMIT 6`);
console.table(sent.length ? sent : [{ note: 'no kickoff emails sent yet' }]);

rule('NEXT EXPECTED SENDS (subscribed teams, upcoming)');
const due = all(`SELECT datetime(m.utc_date,'unixepoch') kickoff_utc,
  h.tla||' v '||a.tla AS match, COUNT(DISTINCT v.email) subscribers
  FROM matches m
  JOIN teams h ON m.home_team_id=h.id JOIN teams a ON m.away_team_id=a.id
  JOIN vip_signups v ON v.confirmed_at IS NOT NULL AND v.unsubscribed_at IS NULL
  LEFT JOIN user_teams ut ON ut.email = v.email
  WHERE m.utc_date > strftime('%s','now')
    AND (h.slug = COALESCE(ut.team_slug, v.team) OR a.slug = COALESCE(ut.team_slug, v.team))
  GROUP BY m.id ORDER BY m.utc_date LIMIT 5`);
console.table(due.length ? due : [{ note: 'no upcoming matches for any subscriber team' }]);

rule('BY SOURCE (utm_source)');
console.table(all(`SELECT COALESCE(utm_source,'direct') source, COUNT(*) signups,
  SUM(confirmed_at IS NOT NULL) confirmed
  FROM vip_signups GROUP BY source ORDER BY signups DESC`));

rule('BY AD CREATIVE (utm_content)');
const ads = all(`SELECT utm_source, COALESCE(utm_content,'(none)') creative, COUNT(*) signups,
  SUM(confirmed_at IS NOT NULL) confirmed
  FROM vip_signups WHERE utm_source IS NOT NULL AND utm_source != 'referral'
  GROUP BY utm_source, utm_content ORDER BY signups DESC`);
console.table(ads.length ? ads : [{ note: 'no attributed ad signups yet' }]);

rule('REFERRALS');
const ref = one(`SELECT COUNT(*) n FROM vip_signups WHERE referred_by IS NOT NULL`);
console.log(`  referred signups: ${ref.n}`);
const topRef = all(`SELECT ref.email AS referrer, COUNT(f.email) AS brought_in
  FROM vip_signups ref JOIN vip_signups f ON f.referred_by = ref.referral_code
  GROUP BY ref.email ORDER BY brought_in DESC LIMIT 5`);
if (topRef.length) console.table(topRef);

rule('"WHAT\'S NEXT" VOTES');
const votes = all(`SELECT REPLACE(request_text,'next-sport: ','') sport, COUNT(*) votes
  FROM feature_requests WHERE request_text LIKE 'next-sport:%'
  GROUP BY request_text ORDER BY votes DESC`);
console.table(votes.length ? votes : [{ note: 'no votes yet' }]);

rule('TEAMS (confirmed, active)');
console.table(all(`SELECT COALESCE(team,'(unset)') team, COUNT(*) fans
  FROM vip_signups WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
  GROUP BY team ORDER BY fans DESC LIMIT 8`));

rule('RECENT SIGNUPS');
console.table(all(`SELECT datetime(created_at,'unixepoch') when_utc, email,
  COALESCE(utm_source,'direct') src,
  CASE WHEN confirmed_at IS NOT NULL THEN 'Y' ELSE '-' END AS conf
  FROM vip_signups ORDER BY created_at DESC LIMIT 10`));

console.log('');
db.close();
