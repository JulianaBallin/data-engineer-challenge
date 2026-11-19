// Base de conhecimento da Olli: transforma os agregados do dashboard em trechos de texto
// pesquisáveis (RAG). Ela só conhece o que existe em api/_data/dashboard.json.
const fs = require("fs");
const path = require("path");

const UF = { AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins" };
const CAT = { health_beauty: "beleza e saúde", watches_gifts: "relógios e presentes", bed_bath_table: "cama, mesa e banho", sports_leisure: "esporte e lazer", computers_accessories: "informática e acessórios", furniture_decor: "móveis e decoração", housewares: "utilidades domésticas", cool_stuff: "coisas legais", auto: "automotivo", garden_tools: "ferramentas de jardim", toys: "brinquedos", perfumery: "perfumaria" };
const PAG = { credit_card: "cartão de crédito", boleto: "boleto", voucher: "voucher", debit_card: "cartão de débito" };
const MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const brl = (v, d = 0) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: d, maximumFractionDigits: d });
const n = (v, d = 0) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const STOP = new Set("quem ganhou a o as os um uma de do da dos das em no na nos nas por para com sem e ou que qual quais quanto quantos quantas como foi sao ser tem ha me te se eu voce mais menos mesmo ate sobre isso essa esse este esta".split(" "));
const SYN = { faturamento: "receita", faturou: "receita", faturam: "receita", arrecadacao: "receita", vendas: "receita", gastaram: "pago", gasto: "pago", gastos: "pago", gastam: "pago", entrega: "prazo", entregas: "prazo", entregar: "prazo", demora: "prazo", demorada: "prazo", demoram: "prazo", rapida: "prazo", lenta: "prazo", compradores: "cliente", clientes: "cliente", consumidores: "cliente", estados: "estado", uf: "estado", avaliacao: "nota", avaliacoes: "nota", estrelas: "nota", satisfacao: "nota", satisfeitos: "nota", cartao: "pagamento", boleto: "pagamento", pagamentos: "pagamento", pagar: "pagamento", produtos: "categoria", produto: "categoria", categorias: "categoria", atrasos: "atraso", atrasados: "atraso", atrasou: "atraso", fretes: "frete", mensal: "mes", meses: "mes", base: "dataset", dados: "dataset", conjunto: "dataset" };
const tokens = (s) => { const out = []; for (const w of norm(s).replace(/[^a-z0-9 ]/g, " ").split(/\s+/)) { if (!w || STOP.has(w) || w.length < 2) continue; out.push(w); if (SYN[w]) out.push(SYN[w]); } return out; };

// frases que, se aparecerem na pergunta, indicam claramente o trecho (reforço de relevância)
const PH = {
  dataset: ["dataset", "base de dados", "conjunto de dados", "sobre o que", "de onde vem", "fonte dos dados", "kaggle", "que dados"],
  olist: ["a olist", "quem e a olist", "o que e a olist"],
  olli: ["quem e voce", "o que voce faz", "quem e a olli", "como voce funciona", "o que voce sabe", "pode me ajudar"],
  tabelas: ["quantos vendedores", "quantos produtos", "quantos registros", "quantas linhas", "tamanho das tabelas", "quantos itens", "quantas avaliacoes"],
  kpis: ["quantos pedidos", "total de pedidos", "quantos clientes", "visao geral", "resumo"],
  "def-receita": ["o que e receita", "como calcula a receita", "receita e lucro", "receita ou lucro"],
  "def-atraso": ["o que e atraso", "como calcula o atraso", "considera atraso", "como medem o atraso", "o que e pedido atrasado"],
  "def-cliente": ["o que e cliente", "como identifica", "recompra e"],
  periodo: ["qual o periodo", "que periodo", "quais anos", "de quando", "ate quando", "meses completos"],
  qualidade: ["qualidade dos dados", "regras de qualidade", "limpeza", "tratamento dos dados"],
  projeto: ["quem fez", "quem criou", "quem desenvolveu", "quem e a autora", "sobre o projeto"],
  dashboard: ["como usar", "como funciona o dashboard", "o que tem no dashboard", "cadeia 3d"],
  "atraso-ranking": ["qual estado tem mais atraso", "estado com mais atraso", "estados com mais atraso", "maior atraso", "mais atrasos", "pior estado", "estados com atraso"],
  "prazo-ranking": ["mais lento", "mais rapido", "maior prazo", "menor prazo", "entrega mais", "demora mais"],
  "frete-ranking": ["frete mais caro", "frete mais barato", "maior frete", "menor frete", "frete medio"],
  top10: ["10 categorias", "top 10", "maiores categorias", "melhores categorias", "categorias que mais vendem", "mais vende", "maior receita"],
  notas: ["distribuicao das notas", "como se distribuem", "notas de 1 a 5"],
  "nota-atraso": ["atraso afeta", "atraso influencia", "atrasados tem nota", "atraso e nota", "atraso afeta a nota"],
  pagamentos: ["mais usado", "meios de pagamento", "forma de pagamento", "como pagam"],
  recorrentes: ["mais de uma vez", "recompra", "clientes recorrentes", "fidelidade"],
  mensal: ["mes a mes", "por mes", "evolucao", "melhor mes", "pior mes"],
  "frete-total": ["quanto de frete", "frete total", "gasto com frete", "pagam de frete"],
  limites: ["limitacao", "limitacoes", "custo do produto", "tem lucro", "margem"],
};

function build() {
  const D = JSON.parse(fs.readFileSync(path.join(__dirname, "_data", "dashboard.json"), "utf-8"));
  const k = D.kpis[0], C = [];
  const add = (id, text, kw = "") => C.push({ id, text, toks: new Set(tokens(text + " " + kw)), ph: PH[id] || [] });

  add("kpis", `Visão geral do histórico Olist (2016 a 2018): ${n(k.pedidos)} pedidos, receita de ${brl(k.receita)} (soma dos itens, sem frete, pedidos não cancelados), ${n(k.clientes)} clientes únicos, ticket médio de ${brl(k.ticket_medio, 2)}, ${n(k.pct_atraso, 2)}% dos pedidos entregues com atraso, nota média ${n(k.nota_media, 2)} e prazo médio de entrega de ${n(k.prazo_medio, 1)} dias.`, "resumo geral total kpi faturamento");

  const share = Object.fromEntries(D.categorias_share.map((c) => [c.categoria, c.pct]));
  D.q1_top10_categorias_receita.forEach((c, i) => add(`cat-${c.categoria}`, `Categoria ${CAT[c.categoria] || c.categoria} (${c.categoria}) é a ${i + 1}ª em receita: ${brl(c.receita)} em ${n(c.pedidos)} pedidos${share[c.categoria] ? `, ${n(share[c.categoria], 2)}% da receita total` : ""}.`, "categoria top ranking receita vendas"));
  add("top10", `As 10 categorias com maior receita, em ordem: ${D.q1_top10_categorias_receita.map((c, i) => `${i + 1}. ${CAT[c.categoria] || c.categoria} (${brl(c.receita)})`).join("; ")}.`, "top 10 categorias maiores receita ranking melhores vendas");

  const prazo = Object.fromEntries(D.prazo_uf.map((p) => [p.uf, p])), frete = Object.fromEntries(D.q4_frete_medio_uf.map((p) => [p.uf, p]));
  D.q2_pct_atraso.filter((r) => r.uf).forEach((r) => add(`uf-${r.uf}`, `Estado ${UF[r.uf] || r.uf} (${r.uf}): ${n(r.pedidos_entregues)} pedidos entregues, ${n(r.pct_atraso, 2)}% com atraso${prazo[r.uf] ? `, prazo médio de ${n(prazo[r.uf].dias, 1)} dias` : ""}${frete[r.uf] ? `, frete médio de ${brl(frete[r.uf].frete_medio, 2)} por item` : ""}.`, `estado uf ${r.uf} logistica atraso prazo frete`));
  const at = D.q2_pct_atraso.filter((r) => r.uf && r.pedidos_entregues >= 200).sort((a, b) => b.pct_atraso - a.pct_atraso);
  add("atraso-ranking", `Estados com mais atraso (mínimo 200 entregas): ${at.slice(0, 5).map((r) => `${UF[r.uf]} ${n(r.pct_atraso, 1)}%`).join(", ")}. Com menos atraso: ${at.slice(-3).map((r) => `${UF[r.uf]} ${n(r.pct_atraso, 1)}%`).join(", ")}. Média nacional ${n(k.pct_atraso, 2)}%.`, "atraso pior melhor estados entregas atrasadas porcentagem");
  const pz = [...D.prazo_uf].sort((a, b) => b.dias - a.dias);
  add("prazo-ranking", `Prazo médio de entrega: mais lento em ${UF[pz[0].uf]} (${n(pz[0].dias, 1)} dias) e mais rápido em ${UF[pz.at(-1).uf]} (${n(pz.at(-1).dias, 1)} dias). Média geral ${n(k.prazo_medio, 1)} dias.`, "tempo entrega dias prazo rapido lento estados");
  const fr = D.q4_frete_medio_uf;
  add("frete-ranking", `Frete médio por item: mais caro em ${UF[fr[0].uf]} (${brl(fr[0].frete_medio, 2)}) e mais barato em ${UF[fr.at(-1).uf]} (${brl(fr.at(-1).frete_medio, 2)}).`, "frete valor medio caro barato envio");

  D.receita_mensal.forEach((m) => { const [y, mm] = m.mes.split("-"); add(`mes-${m.mes}`, `Em ${MES[+mm - 1]} de ${y} (${m.mes}) a receita foi ${brl(m.receita)} com ${n(m.pedidos)} pedidos.`, `mes receita mensal ${y} ${MES[+mm - 1]}`); });
  const rm = [...D.receita_mensal].sort((a, b) => b.receita - a.receita);
  add("mensal", `Receita mês a mês: o melhor mês foi ${rm[0].mes} (${brl(rm[0].receita)}) e o menor foi ${rm.at(-1).mes} (${brl(rm.at(-1).receita)}). Série de ${D.receita_mensal[0].mes} a ${D.receita_mensal.at(-1).mes}, com forte crescimento ao longo de 2017.`, "variacao mes a mes evolucao tendencia crescimento melhor pior mes");

  const tn = D.notas.reduce((a, x) => a + x.pedidos, 0);
  add("notas", `Distribuição das notas de 1 a 5 (${n(tn)} avaliações): ${D.notas.map((x) => `nota ${x.nota}: ${n(x.pedidos)} (${n((x.pedidos / tn) * 100, 1)}%)`).join("; ")}.`, "avaliacao satisfacao estrelas nota distribuicao");
  const [ca, np] = D.q3_nota_atraso.sort((a) => (a.situacao === "Com atraso" ? -1 : 1));
  add("nota-atraso", `Pedidos atrasados têm nota média ${n(ca.nota_media, 2)} (${n(ca.pedidos)} pedidos) contra ${n(np.nota_media, 2)} dos pedidos no prazo (${n(np.pedidos)}). O atraso reduz a nota em cerca de ${n(np.nota_media - ca.nota_media, 2)} pontos.`, "nota media atraso satisfacao cliente impacto");

  const tp = D.pagamentos.reduce((a, x) => a + x.valor, 0), tq = D.pagamentos.reduce((a, x) => a + x.pagamentos, 0);
  D.pagamentos.forEach((p) => add(`pag-${p.tipo}`, `Meio de pagamento ${PAG[p.tipo] || p.tipo}: ${n(p.pagamentos)} pagamentos (${n((p.pagamentos / tq) * 100, 1)}%), somando ${brl(p.valor)}.`, "pagamento meio forma"));
  add("pagamentos", `Meios de pagamento mais usados: ${D.pagamentos.map((p) => `${PAG[p.tipo] || p.tipo} (${n(p.pagamentos)})`).join(", ")}. Total pago: ${brl(tp)}.`, "pagamentos meios mais usados cartao boleto");

  const rc = Object.fromEntries(D.q5_clientes_recorrentes.map((r) => [r.perfil, r]));
  add("recorrentes", `Apenas ${n(rc["Mais de uma compra"].pct, 2)}% dos clientes compraram mais de uma vez (${n(rc["Mais de uma compra"].clientes)} clientes); ${n(rc["Uma compra"].clientes)} compraram uma única vez. Retenção baixa.`, "recompra recorrentes clientes fidelidade retencao");

  const fTot = D.q4_frete_medio_uf.reduce((a, x) => a + x.frete_medio * x.itens, 0);
  add("frete-total", `Frete total estimado: cerca de ${brl(fTot)}, aproximadamente ${n((fTot / tp) * 100, 1)}% do valor pago pelos clientes (${brl(tp)}).`, "frete total gasto cadeia custo");
  add("limites", "Limitações dos dados: não há custo do produto nem margem, então só é possível falar em receita, não lucro. O período vai de 2016 a 2018 e é uma amostra de um marketplace. Valores ausentes não foram imputados e pedidos sem data de entrega ficam sem prazo.", "limitacao custo lucro margem periodo premissa");
  add("dataset", "O dataset é o Brazilian E-Commerce Public Dataset by Olist (Kaggle): cerca de 100 mil pedidos feitos em marketplaces brasileiros entre 2016 e 2018, anonimizados, em 9 tabelas (pedidos, itens, pagamentos, avaliações, clientes, vendedores, produtos, geolocalização e tradução das categorias). É uma amostra de um marketplace, não toda a operação de um varejista.", "sobre o que é o dataset base de dados origem kaggle fonte conjunto de dados dados usados");
  add("olist", "A Olist é uma empresa brasileira de e-commerce que conecta pequenos lojistas a grandes marketplaces, centralizando a venda, a logística e o pagamento. Os dados públicos dela são a base deste projeto.", "quem é a olist empresa o que é a olist");
  add("tabelas", `Tamanho das tabelas: ${n(k.pedidos)} pedidos, 112.650 itens vendidos, 103.886 pagamentos, 99.224 avaliações, ${n(k.clientes)} clientes únicos, 3.095 vendedores, 32.951 produtos e 1.000.163 linhas de geolocalização (agregadas em 19.010 prefixos de CEP).`, "quantos registros linhas tabelas volume tamanho vendedores produtos quantidade");
  add("def-receita", "Receita é a soma do preço dos itens (sem frete) de pedidos não cancelados nem indisponíveis. Receita não é lucro: o dataset não tem custos.", "o que é receita definição como calcula receita faturamento");
  add("def-atraso", "Atraso é quando o pedido chega ao cliente depois da data estimada de entrega. Só entram pedidos entregues (delivered) com datas válidas; pedidos sem data de entrega não têm prazo calculado.", "o que é atraso definição como calcula atraso pedido atrasado");
  add("def-cliente", "Cliente é identificado por customer_unique_id, porque o customer_id muda a cada pedido. Recompra é ter mais de um pedido (não cancelado).", "o que é cliente definição recompra identificar clientes unicos");
  add("periodo", "O histórico vai de 2016 a 2018, mas a série mensal usa só os meses completos, de janeiro de 2017 a agosto de 2018. Os meses de 2016 e de setembro e outubro de 2018 têm pouquíssimos pedidos e ficam de fora.", "período datas anos quando de quando até quando meses completos histórico");
  add("qualidade", "Foram aplicadas 21 regras de qualidade, documentadas com contagem e justificativa. As principais: 189 pedidos com datas fora de ordem foram sinalizados e excluídos das métricas de prazo; 981 mil linhas de geolocalização repetidas foram agregadas por CEP; 610 produtos sem categoria foram rotulados como desconhecida; nenhuma data foi inventada.", "qualidade dos dados regras limpeza tratamento nulos duplicados inconsistencias");
  add("olli", "Sou a Olli, assistente de dados do Olist Insights. Respondo apenas com base no histórico da Olist (vendas, entregas, notas, pagamentos e clientes de 2016 a 2018). Também faço estimativas de receita futura, sempre com a margem de erro, e aviso quando não tenho o dado.", "quem é você o que você faz como funciona ajuda olli assistente capacidades");
  add("projeto", "Este projeto foi desenvolvido por Juliana Ballin Lima para o desafio técnico de Data Engineer I da Bemol Digital: um pipeline ETL com Data Warehouse em DuckDB (camadas bronze, silver e gold), análises das 10 perguntas e este dashboard com login, cadeia 3D e assistente.", "quem fez autora projeto desafio bemol quem criou desenvolvido");
  add("dashboard", "No dashboard há sete seções (visão geral, vendas, logística, satisfação, financeiro, clientes e projeção) e uma página de Cadeia 3D, um mapa em que cada etapa do pedido pode ser clicada para ver só os números dela. Dá para alternar entre tema claro e escuro.", "como usar o dashboard abas seções cadeia 3d mapa navegação tela");
  add("pipeline", "Pipeline: CSVs brutos viram camadas Bronze, Silver e Gold em DuckDB, com modelo estrela (dim_customer, dim_seller, dim_product, dim_date, fact_order_items, fact_payments, fact_orders). Foram aplicadas 21 regras de qualidade documentadas.", "pipeline etl duckdb camadas bronze silver gold modelo estrela qualidade");
  return C;
}

let KB; const kb = () => (KB ||= build());

function retrieve(question, limit = 6) {
  const nq = norm(question), q = tokens(question);
  const df = {}; kb().forEach((c) => c.toks.forEach((t) => (df[t] = (df[t] || 0) + 1)));
  const N = kb().length;
  return kb().map((c) => {
    let s = 0; q.forEach((t) => { if (c.toks.has(t)) s += Math.log(1 + N / df[t]); else for (const x of c.toks) if (t.length > 3 && x.length > 3 && (x.startsWith(t) || t.startsWith(x))) { s += 0.5 * Math.log(1 + N / (df[x] || 1)); break; } });
    if (c.ph.some((p) => nq.includes(p))) s += 6;
    return { c, s };
  }).filter((x) => x.s > 1.1).sort((a, b) => b.s - a.s).slice(0, limit).map((x) => ({ id: x.c.id, text: x.c.text, score: x.s }));
}

module.exports = { retrieve, tokens };
