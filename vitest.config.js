
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        root: '.',
        include: [
            'tests/**/*.{test,spec}.{js,jsx,ts,tsx}',
            'src/**/*.{test,spec}.{js,jsx,ts,tsx}'
        ],
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            'src/frontend/**' // Exclude frontend tests if they need the other config, or include them if they work here.
            // For now, let's focus on backend/unit tests.
        ],
        environment: 'node'
    }
});
