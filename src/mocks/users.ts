import type { UserSummary } from '@/domain/models/user';

const MOCK_USERS: UserSummary[] = [
    {
        did: 'did:plc:p2cp5gopk7mgjegy9waligxd',
        handle: 'desertthunder.dev',
        displayName: 'Desert Thunder',
        bio: 'Building things on the AT Protocol. Open source enthusiast.',
        followerCount: 142,
        followingCount: 87,
    },
    {
        did: 'did:plc:a1b2c3d4e5f6g7h8i9j0k1l2',
        handle: 'alice.tngl.sh',
        displayName: 'Alice Chen',
        bio: 'Distributed systems @ Tangled. TypeScript, Go, Rust.',
        followerCount: 891,
        followingCount: 234,
    },
    {
        did: 'did:plc:b2c3d4e5f6g7h8i9j0k1l2m3',
        handle: 'bob.tngl.sh',
        displayName: 'Bob Nakamura',
        bio: 'Open source contributor. Loves compilers and weird edge cases.',
        followerCount: 307,
        followingCount: 412,
    },
    {
        did: 'did:plc:c3d4e5f6g7h8i9j0k1l2m3n4',
        handle: 'clara.bsky.social',
        displayName: 'Clara Osei',
        bio: 'Frontend dev. Making the decentralized web feel fast.',
        followerCount: 554,
        followingCount: 198,
    },
    {
        did: 'did:plc:d4e5f6g7h8i9j0k1l2m3n4o5',
        handle: 'dev.tangled.sh',
        displayName: 'Tangled Dev',
        bio: 'Official Tangled development account.',
        followerCount: 4210,
        followingCount: 12,
    },
    {
        did: 'did:plc:e5f6g7h8i9j0k1l2m3n4o5p6',
        handle: 'riku.tngl.sh',
        displayName: 'Riku Mäkinen',
        bio: 'Systems programmer. NixOS, Git internals, coffee.',
        followerCount: 228,
        followingCount: 315,
    },
];

export function getMockUsers(): UserSummary[] {
    return MOCK_USERS;
}

export function getMockUser(handle: string): UserSummary | undefined {
    return MOCK_USERS.find((u) => u.handle === handle);
}
