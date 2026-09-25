// Сборка одностраничной версии для хостинга: node build.js → dist/index.html
// Стили и данные встраиваются в страницу, d3 и topojson грузятся с cdnjs.
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');

const scripts = ['js/world.js', 'js/data-countries.js', 'js/data-orgs.js', 'js/data-gov.js', 'js/data-straits.js', 'js/data-disputes.js', 'js/data-resources.js', 'js/data-quiz.js', 'js/data-en.js', 'js/data-quiz-en.js', 'js/app.js'];
for (const f of scripts) if (/<\/script/i.test(read(f))) throw new Error(`${f} содержит </script>`);

const html = `<title>ГеоТренажёр</title>
<meta name="theme-color" content="#0b1d26">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Onest:wght@400;500;600;700&family=Unbounded:wght@500;600&display=swap">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='11' fill='%230b1d26'/%3E%3Cg fill='none' stroke='%23ffb020' stroke-width='1.8' stroke-linecap='round'%3E%3Ccircle cx='12' cy='12' r='7.5'/%3E%3Cpath d='M4.5 12h15M12 4.5c2.3 2.5 2.3 12.5 0 15M12 4.5c-2.3 2.5-2.3 12.5 0 15'/%3E%3C/g%3E%3C/svg%3E">
<style>
${read('css/style.css')}
</style>
<div id="app"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js"></script>
${scripts.map(f => `<script>\n${read(f)}\n</script>`).join('\n')}
`;
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist/index.html'), html);
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' КБ');
