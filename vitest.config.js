
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        root: '.',
        // By default, run unit tests only. Integration tests often require
        // external services/env and are opt-in via RUN_INTEGRATION_TESTS=1.
        include: [
            'tests/unit/**/*.{test,spec}.{js,jsx,ts,tsx}',
            'src/**/*.{test,spec}.{js,jsx,ts,tsx}',
            ...(process.env.RUN_INTEGRATION_TESTS === '1'
                ? ['tests/integration/**/*.{test,spec}.{js,jsx,ts,tsx}']
                : [])
        ],
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            'src/frontend/**',
            // Exclude standalone test scripts that use process.exit() and their own runner
            'tests/*.test.js'
        ],
        environment: 'node'
    }
});
