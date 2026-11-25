import { afterAll, describe, expect, it } from 'vitest';

import { prisma } from '../lib/prisma';

afterAll(async () => {
    await prisma.$disconnect();
});

describe('Prazo das transações nos testes de integração', () => {
    it('permite concluir uma transação que ultrapassa o antigo limite de cinco segundos', async () => {
        const result = await prisma.$transaction((tx) =>
            tx.$queryRaw<{ completed: number }[]>`
                SELECT 1::integer AS completed FROM pg_sleep(6)
            `,
        );

        expect(result).toEqual([{ completed: 1 }]);
    });
});
