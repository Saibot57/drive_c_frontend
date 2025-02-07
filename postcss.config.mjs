import tailwindcss from '@tailwindcss/postcss'; // Import tailwindcss plugin

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: [
    tailwindcss({ package: '@tailwindcss/postcss' }), // Use imported tailwindcss plugin, specify package
    require('autoprefixer'), // Use require for autoprefixer (common practice)
  ],
};

export default config;