# Phase 3 Tasks — Search & Activity Feed

## Search API Discovery

- [ ] Probe `tangled.org` for search endpoints (try `/search?q=`, `/api/search`, check network tab on live site)
- [ ] If JSON search exists, document the request/response format
- [ ] If no JSON search, decide: curated discovery now + backend search later, or HTML scraping

## Search Implementation

- [ ] Create `services/tangled/search.ts` — search service (real endpoint or fallback)
- [ ] Implement debounced search input (300ms) in Explore tab
- [ ] Implement segmented search results: Repos tab, Users tab
- [ ] Implement search result rendering with `RepoCard` and `UserCard`
- [ ] Implement empty search state with suggestions
- [ ] Persist recent searches in local storage (max 20)
- [ ] Clear search history action

## Discovery Sections (if search API unavailable)

- [ ] Implement "Trending repos" section (source TBD — may require appview scraping or curated list)
- [ ] Implement "Recently created repos" section
- [ ] Implement "Suggested users" section
- [ ] Wire discovery sections into Home and Explore tabs

## Activity Feed — Data Source

- [ ] Investigate `tangled.org/timeline` for JSON variant (check with Accept headers)
- [ ] If no JSON timeline, evaluate `@atcute/jetstream` for real-time feed
- [ ] If neither works, implement polling-based feed from known users' PDS records
- [ ] Document chosen approach and any limitations

## Activity Feed — Implementation

- [ ] Create `services/tangled/feed.ts` — feed data source
- [ ] Create normalizer: raw AT Protocol events → `ActivityItem` domain model
- [ ] Implement `ActivityPage` with real feed data
- [ ] Implement filter chips: All, Repos, PRs, Issues, Social
- [ ] Implement infinite scroll with cursor-based pagination
- [ ] Implement pull-to-refresh
- [ ] Implement tap-to-navigate: activity card → repo/profile/PR/issue detail

## Feed Caching

- [ ] Cache last 100 feed items in IndexedDB via query persister
- [ ] Show cached feed immediately on tab switch
- [ ] Stale time: 1 minute
- [ ] Verify feed persists across app restarts

## Home Tab

- [ ] Wire Home tab to real data: trending repos + recent activity
- [ ] Add "personalized" section placeholder (shows sign-in prompt when unauthenticated)

## Quality

- [ ] Test search with various queries — verify results are relevant
- [ ] Test activity feed with pull-to-refresh and pagination
- [ ] Test offline: cached feed shows, search degrades gracefully
- [ ] Verify no duplicate items in feed after refresh
