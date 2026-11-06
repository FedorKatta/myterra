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

// Раздел «Философия»: dist/philosophy.html (шрифты — Google Fonts, остальное встроено)
const philoScripts = ['js/philo-topics-1.js', 'js/philo-topics-2.js', 'js/philo-topics-3.js', 'js/philo-topics-4.js', 'js/philo-topics-5.js', 'js/philo-people.js', 'js/philo.js'];
for (const f of philoScripts) if (/<\/script/i.test(read(f))) throw new Error(`${f} содержит </script>`);
const philo = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#f2eadb" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#14100c" media="(prefers-color-scheme: dark)">
<title>Философия — подготовка к экзамену</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&family=Onest:wght@400;500;600&display=swap">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='11' fill='%239b2f1f'/%3E%3Ctext x='12' y='16.6' text-anchor='middle' font-family='Georgia,serif' font-size='14' fill='%23fbf7ee'%3E%CF%86%3C/text%3E%3C/svg%3E">
<style>
${read('css/philo.css')}
</style>
</head>
<body>
<div id="app"></div>
${philoScripts.map(f => `<script>\n${read(f)}\n</script>`).join('\n')}
</body>
</html>
`;
fs.writeFileSync(path.join(__dirname, 'dist/philosophy.html'), philo);
console.log('dist/philosophy.html', (philo.length / 1024).toFixed(0) + ' КБ');
