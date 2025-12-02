
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        root: '.',
        include: [
            'tests/unit/**/*.{test,spec}.{js,jsx,ts,tsx}',
            'tests/integration/**/*.{test,spec}.{js,jsx,ts,tsx}',
            'src/**/*.{test,spec}.{js,jsx,ts,tsx}'
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
