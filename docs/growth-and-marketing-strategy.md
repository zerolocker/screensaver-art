# Growth strategy

The reasoning behind the growth plan. Current status and the backlog are in [`GROWTH-PROGRESS.md`](GROWTH-PROGRESS.md).

## Summary

1. **The art is the marketing.** We make new video every night at almost no cost. Everything should use it.
2. **Organic, not paid.** At $0.99 a month, a paying user is worth maybe $10–20. Ads would cost $20–50 or more per paying user.
3. **Our edge is curation and freshness.** The free competitors (Aerial, Wallpaper Engine, Lively) offer a fixed library or an endless pile of user uploads.
4. **Prove demand on Mac first.** Don't build Windows or anything else until Mac traffic converts.
5. **Founder time is about zero.** Only automated or one-time work actually happens.
6. **Nothing downstream is tested yet.** Traffic is still near zero, so download, activation and payment rates are unknown. Don't change price, copy or onboarding in response to a failed launch.

## Positioning and audience

- One line: *"A new, curated piece of art on your Mac every day, as your screensaver."*
- Audience: Mac users who care how their desk looks; designers, writers and developers who look at a screen all day; people who like AI art but don't want to make it. Sell the look, not the technology.

## Channels

**Social (the main channel).** Post every night to Pinterest, YouTube Shorts, Instagram Reels and TikTok. Treat them equally until the UTM data shows which one converts. Getting featured by a large art, aesthetic or desk-setup account is worth months of our own posts. That can't be automated: an agent prepares the list and drafts, and the founder sends them.

**Phones.** Most social viewers are on a phone and can't install a Mac app there. The "email me the Mac link" flow catches that interest, so phone-first platforms aren't a handicap.

**Launch sites.** Product Hunt got 5 upvotes and Show HN refused the post. We can't know why Product Hunt flopped, and since almost nobody saw it, it says nothing about demand. Don't build plans around one-shot channels. Reddit is still unused and can be repeated across subreddits.

**Gallery landing pages.** Each social post needs its own destination, so every piece has a page. These pages are not an SEO bet: AI homages won't rank for movement names, and hundreds of generated pages could get the whole domain penalized, including the brand searches that matter. So `/art/*` is `noindex` (`INDEX_ART_PAGES` in `lib/gallery-catalog.ts`), while `/gallery` and `/era/*` are indexable. Per-movement pages are deferred because most movements have only one piece.

**Directories and press.** List on alternativeto.net (as an alternative to Aerial), MacUpdate and indie directories; each is also a backlink. Pitch 9to5Mac, MacStories, Cult of Mac and MacRumors with the story: a screensaver that makes new art every night. In the Aerial and PaperSaver community, show up as a builder, not an advertiser.

**Email (parked).** The one channel we own. An "art of the week" email is worth building only if it can send from the nightly job.

**Wallpaper Engine and Lively (parked).** Publish a free pack of 8–15 free-tier pieces to their 20–50M users, with a tagged link back to us. Never include subscriber-only art. Check each platform's rules on promotional links. Drop it if two to four weeks bring no traffic.

**Mac App Store (later).** A discovery surface, but it costs 15–30% and requires in-app purchase. Check it once the funnel converts.

## Conversion and activation

- The download button adapts: Mac visitors download, phone visitors get the email-the-link form, and everyone can say which other platforms they want. We ask rather than detect the OS, because mislabeling a Mac visitor would lose them.
- Every shared link shows a rich preview card.
- The "wow" moment is art playing on the user's screen. Track install → first sync → screensaver set. A drop there is worth more than more traffic.

## Retention

- The product promise is fresh, good art. Bad art causes churn.
- Watch churn at the 3-month renewal charge.
- Later: onboarding, "new this week" and win-back emails.

## Pricing (closed until there is traffic)

This category pays once: Wallpaper Engine is $4.99, Aerial is free, paid screensavers are one-time purchases. So a $15.99 lifetime option sits beside the subscription. Ideas to test once there is traffic: an annual plan (about $9.99) and a time-limited trial of the full gallery.

## Windows (parked)

Windows is most of the desktop market, but its users expect free screensaver and wallpaper apps, and a native Windows screensaver is weeks of work. Build it only if the demand probe shows real interest.

## Paid ads (not now)

Only after the funnel is proven. Then spend $100–200 boosting a post that already did well organically, preferring Reddit ads over Google search. If cost per paying user can't get under about $10–15, stop.

## Social posting automation

- **Buy, don't build.** TikTok's posting API keeps posts from unaudited apps private, and the audit requires a UI we don't have. Instagram, YouTube and Pinterest each have their own review. Zernio has already passed all of them and posts to all four channels for about $12 a month.
- **Our own music.** Commercial accounts can't use trending sounds on YouTube Shorts or TikTok, and posting APIs can't attach them anyway. So each clip gets music generated for that piece (Lyria). Pinterest mostly plays muted.
- **Scheduled posts aren't penalized** (Instagram has said so). The useful human time is replying to early comments.

## Don'ts

- Don't make paid ads the main channel.
- Don't build Windows before demand shows up.
- Don't turn into a wallpaper engine. Distribute into those ecosystems instead.
- Don't build our own social-posting layer.
- Don't read a launch flop as a verdict on the product.
- Don't plan anything that needs a recurring human chore.
- Don't let art quality slip.

## Market

| Market | Size | Price | Main player | What it means for us |
|---|---|---|---|---|
| Live wallpaper | 20–50M (Wallpaper Engine), 14M+ (Lively) | $5 once, or free | Wallpaper Engine, Lively | Huge but free; distribute into it |
| Mac screensaver | Niche | Free or one-time | Aerial (free, Apple footage only) | Room for curated, fresh art |
| Desktop OS | Windows ~60% US, Mac ~23% US | | | Windows is who sees our posts, but not who to build for first |

## Sources

- [TikTok Content Posting API](https://developers.tiktok.com/doc/content-posting-api-get-started/): posts from unaudited clients are private.
- [YouTube: commercial channels and the Shorts audio library](https://support.google.com/youtube/answer/10383400?hl=en)
- [Wallpaper Engine owners (SteamSpy)](https://steamspy.com/app/431960), [Lively](https://github.com/rocksdanister/lively)
- [StatCounter desktop OS share (US)](https://gs.statcounter.com/os-market-share/desktop/united-states-of-america)
