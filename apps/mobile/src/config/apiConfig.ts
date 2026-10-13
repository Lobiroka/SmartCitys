function requireApiUrl(
    value: string | undefined,
): string {
    if (!value) {
        throw new Error(
            'A variável EXPO_PUBLIC_API_URL não foi configurada.',
        );
    }

    return value;
}

export const apiConfig = {
    baseUrl: requireApiUrl(
        process.env.EXPO_PUBLIC_API_URL,
    ).replace(/\/$/, ''),
};
