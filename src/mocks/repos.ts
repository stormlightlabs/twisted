import type { RepoSummary, RepoDetail, RepoFile } from '@/domain/models/repo';

// Timestamps within the last 30 days (relative to 2026-03-22)
const MOCK_REPOS: RepoSummary[] = [
    {
        atUri: 'at://did:plc:a1b2c3d4e5f6g7h8i9j0k1l2/sh.tangled.repo/atproto-explorer',
        ownerDid: 'did:plc:a1b2c3d4e5f6g7h8i9j0k1l2',
        ownerHandle: 'alice.tngl.sh',
        name: 'atproto-explorer',
        description: 'Interactive explorer for AT Protocol lexicons and records.',
        primaryLanguage: 'TypeScript',
        stars: 312,
        forks: 28,
        updatedAt: '2026-03-21T14:32:00Z',
        knot: 'tangled.sh',
    },
    {
        atUri: 'at://did:plc:p2cp5gopk7mgjegy9waligxd/sh.tangled.repo/twisted',
        ownerDid: 'did:plc:p2cp5gopk7mgjegy9waligxd',
        ownerHandle: 'desertthunder.dev',
        name: 'twisted',
        description: 'A mobile companion reader for Tangled, built with Ionic Vue.',
        primaryLanguage: 'TypeScript',
        stars: 47,
        forks: 3,
        updatedAt: '2026-03-22T09:15:00Z',
        knot: 'tangled.sh',
    },
    {
        atUri: 'at://did:plc:b2c3d4e5f6g7h8i9j0k1l2m3/sh.tangled.repo/git-log-pretty',
        ownerDid: 'did:plc:b2c3d4e5f6g7h8i9j0k1l2m3',
        ownerHandle: 'bob.tngl.sh',
        name: 'git-log-pretty',
        description: 'Opinionated git log formatter with colour themes and TUI.',
        primaryLanguage: 'Go',
        stars: 189,
        forks: 14,
        updatedAt: '2026-03-19T22:08:00Z',
        knot: 'tangled.sh',
    },
    {
        atUri: 'at://did:plc:c3d4e5f6g7h8i9j0k1l2m3n4/sh.tangled.repo/iris-ui',
        ownerDid: 'did:plc:c3d4e5f6g7h8i9j0k1l2m3n4',
        ownerHandle: 'clara.bsky.social',
        name: 'iris-ui',
        description: 'Accessible component library for AT Protocol apps.',
        primaryLanguage: 'TypeScript',
        stars: 631,
        forks: 72,
        updatedAt: '2026-03-20T11:45:00Z',
        knot: 'tangled.sh',
    },
    {
        atUri: 'at://did:plc:e5f6g7h8i9j0k1l2m3n4o5p6/sh.tangled.repo/nix-atproto',
        ownerDid: 'did:plc:e5f6g7h8i9j0k1l2m3n4o5p6',
        ownerHandle: 'riku.tngl.sh',
        name: 'nix-atproto',
        description: 'Nix flakes and modules for self-hosting AT Protocol services.',
        primaryLanguage: 'Nix',
        stars: 94,
        forks: 11,
        updatedAt: '2026-03-17T08:30:00Z',
        knot: 'tangled.sh',
    },
    {
        atUri: 'at://did:plc:d4e5f6g7h8i9j0k1l2m3n4o5/sh.tangled.repo/tangled-cli',
        ownerDid: 'did:plc:d4e5f6g7h8i9j0k1l2m3n4o5',
        ownerHandle: 'dev.tangled.sh',
        name: 'tangled-cli',
        description: 'Official command-line tool for interacting with the Tangled platform.',
        primaryLanguage: 'Go',
        stars: 1842,
        forks: 203,
        updatedAt: '2026-03-22T07:00:00Z',
        knot: 'tangled.sh',
    },
    {
        atUri: 'at://did:plc:a1b2c3d4e5f6g7h8i9j0k1l2/sh.tangled.repo/lexicon-validator',
        ownerDid: 'did:plc:a1b2c3d4e5f6g7h8i9j0k1l2',
        ownerHandle: 'alice.tngl.sh',
        name: 'lexicon-validator',
        description: 'Runtime validation for AT Protocol lexicon schemas.',
        primaryLanguage: 'TypeScript',
        stars: 77,
        forks: 9,
        updatedAt: '2026-03-14T16:20:00Z',
        knot: 'tangled.sh',
    },
    {
        atUri: 'at://did:plc:p2cp5gopk7mgjegy9waligxd/sh.tangled.repo/bsky-feeds',
        ownerDid: 'did:plc:p2cp5gopk7mgjegy9waligxd',
        ownerHandle: 'desertthunder.dev',
        name: 'bsky-feeds',
        description: 'Custom Bluesky feed generators with a simple declarative API.',
        primaryLanguage: 'Python',
        stars: 203,
        forks: 31,
        updatedAt: '2026-03-10T19:55:00Z',
        knot: 'tangled.sh',
    },
];

const MOCK_REPO_FILES: RepoFile[] = [
    { path: '', name: 'src', type: 'dir', lastCommitMessage: 'feat: add skeleton loaders' },
    { path: '', name: 'docs', type: 'dir', lastCommitMessage: 'docs: update phase-1 spec' },
    { path: '', name: 'public', type: 'dir', lastCommitMessage: 'chore: add favicon' },
    { path: '', name: '.gitignore', type: 'file', size: 412, lastCommitMessage: 'chore: initial scaffold' },
    { path: '', name: 'package.json', type: 'file', size: 1840, lastCommitMessage: 'chore: add tanstack query' },
    { path: '', name: 'README.md', type: 'file', size: 2310, lastCommitMessage: 'docs: update readme' },
    { path: '', name: 'tsconfig.json', type: 'file', size: 688, lastCommitMessage: 'chore: initial scaffold' },
    { path: '', name: 'vite.config.ts', type: 'file', size: 520, lastCommitMessage: 'chore: path aliases' },
];

const README_CONTENT = `# twisted

A mobile companion reader for [Tangled](https://tangled.sh), built with Ionic Vue and Capacitor.

## Features

- Browse repositories, files, and READMEs
- View issues and pull requests
- Activity feed (global and personalized)
- Sign in via AT Protocol OAuth

## Getting Started

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

## Tech Stack

- Vue 3 + TypeScript
- Ionic Vue
- Capacitor (iOS / Android)
- Pinia + TanStack Query
`;

export function getMockRepos(): RepoSummary[] {
    return MOCK_REPOS;
}

export function getMockRepoDetail(ownerHandle: string, name: string): RepoDetail | undefined {
    const summary = MOCK_REPOS.find((r) => r.ownerHandle === ownerHandle && r.name === name);
    if (!summary) return undefined;

    return {
        ...summary,
        readme: README_CONTENT,
        defaultBranch: 'main',
        languages: summary.primaryLanguage
            ? { [summary.primaryLanguage]: 85, Other: 15 }
            : {},
        topics: ['atproto', 'tangled', 'open-source'],
    };
}

export function getMockRepoFiles(): RepoFile[] {
    return MOCK_REPO_FILES;
}

export function getTrendingRepos(): RepoSummary[] {
    return [...MOCK_REPOS].sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0)).slice(0, 5);
}
