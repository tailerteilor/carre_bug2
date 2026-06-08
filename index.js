const puppeteer = require('puppeteer');
const fs = require('fs');

// ==========================================
// CONFIGURAÇÕES
// ==========================================
const TARGET_CEP = '90160-181'; 
const MAX_PAGES = 2; 
const WAIT_AFTER_SCROLL = 2000;

// Varredura dupla para burlar limites
const SORTS = ['name_asc', 'name_desc'];

(async () => {
    console.log('Iniciando o Carrefour Pro Analytics V10 no Servidor...');
    
    const browser = await puppeteer.launch({ 
        headless: false, 
        defaultViewport: null,
        args: ['--start-maximized']
    });
    
    const page = await browser.newPage();

    // ==========================================
    // 1. INJEÇÃO DO CEP PARA PREÇOS LOCAIS
    // ==========================================
    console.log(`Acessando a página inicial para definir a região (CEP: ${TARGET_CEP})...`);
    await page.goto('https://mercado.carrefour.com.br/', { waitUntil: 'networkidle2', timeout: 60000 });

    console.log('Injetando a requisição de regionalização...');
    await page.evaluate(async (cep) => {
        try {
            await fetch("https://mercado.carrefour.com.br/action/set-regionalization.data", {
                "headers": {
                    "accept": "*/*",
                    "content-type": "application/x-www-form-urlencoded;charset=UTF-8"
                },
                "body": `page-view-id=42ab34a6-4420-460f-89c6-37c4777d3c1c&source=cep-component&CEP=${cep}`,
                "method": "POST"
            });
        } catch (error) {
            console.error('Erro ao definir CEP:', error);
        }
    }, TARGET_CEP);

    console.log('Aguardando os cookies da região serem aplicados...');
    await new Promise(r => setTimeout(r, 4000));

    // ==========================================
    // 2. LOOP DUPLO DE EXTRAÇÃO (A-Z e Z-A)
    // ==========================================
    let allProducts = [];
    let scrapedUrls = new Set();

    for (let sortType of SORTS) {
        console.log(`\n======================================================`);
        console.log(`INICIANDO BUSCA COM ORDENAÇÃO: ${sortType.toUpperCase()}`);
        console.log(`======================================================`);

        for (let currentPage = 1; currentPage <= MAX_PAGES; currentPage++) {
            const url = `https://mercado.carrefour.com.br/busca/%20?sort=${sortType}&count=99&page=${currentPage}`;
            console.log(`\n[${sortType} - Página ${currentPage}/${MAX_PAGES}] Acessando busca...`);
            
            try {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
            } catch (error) {
                console.log(`Aviso: Demora no carregamento da página ${currentPage}. Continuando...`);
            }

            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    let distance = 450;
                    let maxScrolls = 0;
                    const maxScrollLimit = 80;
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        maxScrolls++;
                        if ((window.innerHeight + window.scrollY) >= scrollHeight - 100 || maxScrolls > maxScrollLimit) {
                            clearInterval(timer);
                            window.scrollTo(0, 0);
                            setTimeout(resolve, 1000);
                        }
                    }, 120);
                });
            });

            await new Promise(r => setTimeout(r, WAIT_AFTER_SCROLL));

            const pageProducts = await page.evaluate(() => {
                const products = [];
                const productElements = document.querySelectorAll('a[data-testid="search-product-card"], div[data-testid="product-card"], div[class*="product-card"]');
                
                productElements.forEach(product => {
                    try {
                        const linkElement = product.href ? product : product.querySelector('a');
                        const link = linkElement ? linkElement.href : '';
                        if (!link) return;

                        const nameElement = product.querySelector('h2, span[data-testid="product-card-name"], [class*="product-name"]');
                        let priceElement = product.querySelector('[class*="text-price"], .text-base.font-bold, span[data-testid="product-card-price"]');
                        
                        if (!priceElement) {
                            const spans = product.querySelectorAll('span');
                            for (let s of spans) {
                                if (s.innerText.includes('R$') && s.innerText.length < 15) {
                                    priceElement = s;
                                    break;
                                }
                            }
                        }

                        let oldPriceElement = product.querySelector('span.line-through, span[class*="text-gray-medium"]');
                        const imgElement = product.querySelector('img');
                        const imageSrc = imgElement ? (imgElement.src || imgElement.dataset.src) : '';

                        const productData = {
                            id: link.split('/p/')[1] || Math.random().toString(36).substr(2, 9),
                            name: nameElement ? nameElement.innerText.trim() : 'Produto sem nome',
                            price: priceElement ? priceElement.innerText.trim() : '',
                            priceValue: 0,
                            oldPriceValue: 0,
                            link: link,
                            image: imageSrc,
                            discount: 0, 
                            effectiveDiscount: 0, 
                            promotionType: 'none',
                            promotionText: ''
                        };

                        if (productData.price) {
                            productData.priceValue = parseFloat(productData.price.replace(/[^0-9,]/g, '').replace(',', '.')) || 0;
                        }
                        if (oldPriceElement) {
                            productData.oldPriceValue = parseFloat(oldPriceElement.innerText.replace(/[^0-9,]/g, '').replace(',', '.')) || 0;
                        }

                        let detectedPromos = [];
                        let priceDropDiscount = 0;      
                        let mechanicDiscount = 0;       

                        if (productData.oldPriceValue > productData.priceValue && productData.oldPriceValue > 0) {
                            priceDropDiscount = (productData.oldPriceValue - productData.priceValue) / productData.oldPriceValue;
                            detectedPromos.push({ type: 'percentage', text: `-${Math.round(priceDropDiscount*100)}%` });
                        }

                        const potentialBadges = Array.from(product.querySelectorAll('span, div[class*="badge"], div[style*="background-color"]'));
                        
                        potentialBadges.forEach(badge => {
                            const text = badge.innerText.toUpperCase().trim();
                            if (text.length < 3 || text.length > 50) return;

                            const leveMatch = /LEVE\s+(\d+)\s+PAGUE\s+(\d+)/i.exec(text);
                            if (leveMatch) {
                                const leve = parseFloat(leveMatch[1]);
                                const pague = parseFloat(leveMatch[2]);
                                if (leve > pague) {
                                    const thisMechDisc = (leve - pague) / leve;
                                    if (thisMechDisc > mechanicDiscount) mechanicDiscount = thisMechDisc;
                                    detectedPromos.push({ type: 'leve_pague', text: text });
                                }
                            }
                            else if ((text.includes('NA 2') || text.includes('2ª') || text.includes('SEGUNDA')) && 
                                     (text.includes('OFF') || text.includes('DESC') || text.includes('UN'))) {
                                
                                detectedPromos.push({ type: 'second_unit', text: text });
                                let thisMechDisc = 0;
                                const percentMatch = /(\d+)%\s+(?:OFF|DESC)/.exec(text);
                                if (percentMatch) {
                                    thisMechDisc = (parseFloat(percentMatch[1]) / 100) / 2;
                                } else if (text.includes('GRÁTIS') || text.includes('GRATIS')) {
                                    thisMechDisc = 0.5;
                                }
                                if (thisMechDisc > mechanicDiscount) mechanicDiscount = thisMechDisc;
                            }
                            else if (text.includes('%') && (text.includes('OFF') || text.includes('DESC'))) {
                                const numVal = parseInt(text.replace(/\D/g, ''));
                                if (numVal > 0) {
                                    if (priceDropDiscount === 0) priceDropDiscount = numVal / 100;
                                    detectedPromos.push({ type: 'percentage', text: text });
                                }
                            }
                        });

                        const finalFactor = (1 - priceDropDiscount) * (1 - mechanicDiscount);
                        productData.effectiveDiscount = Math.round((1 - finalFactor) * 100);
                        
                        const uniqueTexts = [...new Set(detectedPromos.map(p => p.text))];
                        productData.promotionText = uniqueTexts.join(' | ');
                        const types = new Set(detectedPromos.map(p => p.type));

                        if (types.has('leve_pague') && types.has('second_unit')) productData.promotionType = 'combo'; 
                        else if ((types.has('leve_pague') || types.has('second_unit')) && types.has('percentage')) productData.promotionType = 'combo';
                        else if (types.has('leve_pague')) productData.promotionType = 'leve_pague';
                        else if (types.has('second_unit')) productData.promotionType = 'second_unit';
                        else if (types.has('percentage')) productData.promotionType = 'percentage';

                        if (productData.effectiveDiscount > 0 || productData.promotionType !== 'none') {
                            if (productData.priceValue > 0 && productData.name) {
                                products.push(productData);
                            }
                        }
                    } catch (e) {}
                });
                return products;
            });

            let novos = 0;
            for (let p of pageProducts) {
                if (!scrapedUrls.has(p.link)) {
                    scrapedUrls.add(p.link);
                    allProducts.push(p);
                    novos++;
                }
            }
            
            console.log(`[${sortType} - Página ${currentPage}] +${novos} inéditas. Total: ${allProducts.length}`);
            if (pageProducts.length === 0) break; 
        }
    }

    // ==========================================
    // 3. GERAÇÃO DO NOME DO ARQUIVO
    // ==========================================
    console.log('\nGerando relatório dinâmico interativo...');
    
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dataHoraStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}`;
    const dataVisivel = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} às ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    
    const filenameHtml = `Carrefour_${dataHoraStr}.html`;

    // ==========================================
    // 4. TEMPLATE HTML COM FILTROS OFFLINE E CSS FLUIDO
    // ==========================================
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ofertas Carrefour</title>
        <style>
            :root { --primary: #003087; --bg: #f3f4f6; }
            body { font-family: sans-serif; background: var(--bg); margin: 0; padding: 15px; }
            .header { background: var(--primary); color: white; padding: 15px; text-align: center; border-radius: 8px; margin-bottom: 20px; }
            
            /* Controles de Filtro */
            .controls { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; justify-content: center; }
            .controls select { padding: 10px; border-radius: 6px; border: 1px solid #ccc; font-size: 14px; flex: 1; min-width: 200px; max-width: 300px; outline: none; background: white; cursor: pointer; }
            
            /* Grid Responsivo Universal */
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 15px; }
            
            /* Card Fluido (Não quebra o nome) */
            .card { background: white; border-radius: 8px; padding: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: flex; flex-direction: column; }
            .img-box { height: 140px; text-align: center; margin-bottom: 10px; }
            .img-box img { max-height: 100%; max-width: 100%; object-fit: contain; }
            
            /* O título agora cresce o quanto precisar */
            h3 { font-size: 14px; line-height: 1.4; margin: 0 0 10px 0; color: #333; word-break: break-word; }
            
            /* Empurra os preços e botão para o final do card */
            .card-footer { margin-top: auto; }
            .price { font-size: 18px; font-weight: bold; color: var(--primary); }
            .old-price { font-size: 12px; text-decoration: line-through; color: #888; margin-right: 5px; }
            
            /* Selos promocionais */
            .badges { margin-bottom: 8px; display: flex; flex-wrap: wrap; gap: 4px; }
            .badge { display: inline-block; font-size: 11px; font-weight: bold; color: white; background: #E81E26; padding: 3px 6px; border-radius: 4px; }
            .badge-green { background: #10B981; }
            
            .btn-link { display: block; background: var(--primary); color: white; text-align: center; padding: 10px; border-radius: 4px; font-size: 13px; font-weight: bold; margin-top: 10px; text-decoration: none; }
        </style>
    </head>
    <body>
        <div class="header">
            <h2>Ofertas Mapeadas - Menino Deus</h2>
            <p>${allProducts.length} produtos em ${dataVisivel}</p>
        </div>

        <div class="controls">
            <select id="sortSelect" onchange="aplicarFiltros()">
                <option value="maior_desconto">Ordenar: Maior Desconto Real</option>
                <option value="menor_preco">Ordenar: Menor Preço</option>
            </select>
            <select id="filterSelect" onchange="aplicarFiltros()">
                <option value="todas">Mostrar: Todas as Ofertas</option>
                <option value="combo">Mostrar: Apenas Ofertas Combadas 🔥</option>
            </select>
        </div>

        <div class="grid" id="grid">
            ${allProducts.map(p => `
                <div class="card" data-price="${p.priceValue}" data-discount="${p.effectiveDiscount}" data-combo="${p.promotionType === 'combo' ? 'true' : 'false'}">
                    <div class="badges">
                        ${p.effectiveDiscount > 0 ? `<span class="badge badge-green">-${p.effectiveDiscount}%</span>` : ''}
                        ${p.promotionType === 'leve_pague' ? '<span class="badge">Leve+ Pague-</span>' : ''}
                        ${p.promotionType === 'combo' ? '<span class="badge">COMBO</span>' : ''}
                    </div>
                    <div class="img-box"><img src="${p.image}" loading="lazy"></div>
                    <h3>${p.name}</h3>
                    <div class="card-footer">
                        <div>
                            ${p.oldPriceValue > 0 ? `<span class="old-price">R$ ${p.oldPriceValue.toFixed(2).replace('.',',')}</span>` : ''}
                            <span class="price">${p.price}</span>
                        </div>
                        <a href="${p.link}" class="btn-link" target="_blank">VER NO SITE</a>
                    </div>
                </div>
            `).join('')}
        </div>

        <script>
            function aplicarFiltros() {
                const sortVal = document.getElementById('sortSelect').value;
                const filterVal = document.getElementById('filterSelect').value;
                const grid = document.getElementById('grid');
                const cards = Array.from(grid.getElementsByClassName('card'));

                // Lógica de Ordenação
                cards.sort((a, b) => {
                    if (sortVal === 'maior_desconto') {
                        return parseFloat(b.dataset.discount) - parseFloat(a.dataset.discount);
                    } else if (sortVal === 'menor_preco') {
                        return parseFloat(a.dataset.price) - parseFloat(b.dataset.price);
                    }
                });

                // Lógica de Filtragem e Re-inserção no Grid
                cards.forEach(card => {
                    const isCombo = card.dataset.combo === 'true';
                    
                    if (filterVal === 'combo' && !isCombo) {
                        card.style.display = 'none';
                    } else {
                        card.style.display = 'flex';
                    }
                    grid.appendChild(card);
                });
            }
            
            // Executa a primeira ordenação ao abrir o arquivo
            aplicarFiltros();
        </script>
    </body>
    </html>`;

    fs.writeFileSync(filenameHtml, htmlContent);
    fs.writeFileSync('dados_brutos.json', JSON.stringify(allProducts, null, 2));

    console.log('✅ Tudo Pronto!');
    console.log(`Arquivo gerado: ${filenameHtml}`);

    await browser.close();
})();