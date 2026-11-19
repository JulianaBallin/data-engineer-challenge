# Regras de Qualidade de Dados

> Documento gerado automaticamente por `src/transform.py` a cada execução do pipeline.
> Os valores de *registros* refletem a última execução.

## Volumetria (entrada → saída da camada Silver)

| Tabela | Linhas RAW | Linhas Silver | Removidas |
|---|---:|---:|---:|
| orders | 99,441 | 99,441 | 0 |
| order_items | 112,650 | 112,650 | 0 |
| order_payments | 103,886 | 103,883 | 3 |
| order_reviews | 99,224 | 99,224 | 0 |
| customers | 99,441 | 99,441 | 0 |
| sellers | 3,095 | 3,095 | 0 |
| category_translation | 71 | 71 | 0 |
| geolocation | 1,000,163 | 19,010 | 981,153 |
| products | 32,951 | 32,951 | 0 |

## Regras aplicadas

| # | Tabela | Problema identificado | Tratamento aplicado | Registros | Justificativa |
|--:|---|---|---|--:|---|
| 1 | orders | Cronologia inválida (aprovação/postagem/entrega anterior à etapa precedente) | Pedido sinalizado em `has_date_inconsistency`; excluído das métricas de prazo | 189 | Não corrigimos datas por suposição; apenas evitamos prazos negativos nas métricas |
| 2 | orders | Status 'delivered' sem data de entrega ao cliente | Mantido; data permanece nula e prazo de entrega fica nulo | 8 | Não se inventa data de entrega (premissa do desafio) |
| 3 | orders | Data de entrega preenchida com status diferente de 'delivered' | Mantido; métricas de prazo consideram apenas status 'delivered' | 6 | Status é a fonte de verdade sobre a conclusão do pedido |
| 4 | order_payments | Pagamento com valor inválido ou tipo 'not_defined' | Linha removida | 3 | Registro sem meio de pagamento válido não representa transação |
| 5 | order_payments | Parcelas < 1 | Ajustadas para 1 | 2 | Todo pagamento tem ao menos uma parcela |
| 6 | order_reviews | review_id repetido em pedidos distintos (linhas não idênticas) | Mantido na Silver; na Gold usa-se 1 avaliação por pedido (a mais recente) | 814 | review_id não é único no dataset; a unicidade correta é por pedido nas análises |
| 7 | customers | Cidade com acentos/caixa/espaços variados; CEP sem zeros à esquerda | Cidade em minúsculas sem acento; UF em maiúsculas; CEP com 5 dígitos | 99,441 | Padronização para joins e agrupamentos consistentes |
| 8 | sellers | Cidade com variações de grafia; CEP sem zeros à esquerda | Mesma padronização aplicada a customers | 3,095 | Consistência entre tabelas |
| 9 | geolocation | Coordenadas nulas ou fora do território brasileiro | Linha removida | 42 | Pontos fora do Brasil são erros de geocodificação |
| 10 | geolocation | Múltiplas coordenadas por prefixo de CEP (milhares de repetições) | Agregado em 1 linha por prefixo: média de lat/lng e cidade/UF mais frequentes | 981,111 | Torna o prefixo de CEP uma chave única e evita explosão de linhas em joins |
| 11 | products | Colunas com erro de grafia (`lenght`) | Renomeadas para `length` | 2 | Nomes corretos evitam erros em consultas |
| 12 | products | Peso igual a 0 g (fisicamente impossível) | Convertido para nulo | 4 | Zero indica ausência de medição, não peso real |
| 13 | products | Categoria ausente | Rotulada 'desconhecida' (sem inferir categoria) | 610 | Mantém o produto nas análises sem criar informação artificial |
| 14 | products | Categorias sem tradução no arquivo oficial: pc_gamer, portateis_cozinha_e_preparadores_de_alimentos | Tradução manual adicionada | 13 | Garante 100% de cobertura de tradução |
| 15 | order_items | Integridade referencial: order_id sem correspondente em orders.order_id | Verificado; sem remoção | 0 | Relacionamentos consistentes são requisito de qualidade |
| 16 | order_items | Integridade referencial: product_id sem correspondente em products.product_id | Verificado; sem remoção | 0 | Relacionamentos consistentes são requisito de qualidade |
| 17 | order_items | Integridade referencial: seller_id sem correspondente em sellers.seller_id | Verificado; sem remoção | 0 | Relacionamentos consistentes são requisito de qualidade |
| 18 | order_payments | Integridade referencial: order_id sem correspondente em orders.order_id | Verificado; sem remoção | 0 | Relacionamentos consistentes são requisito de qualidade |
| 19 | order_reviews | Integridade referencial: order_id sem correspondente em orders.order_id | Verificado; sem remoção | 0 | Relacionamentos consistentes são requisito de qualidade |
| 20 | orders | Integridade referencial: customer_id sem correspondente em customers.customer_id | Verificado; sem remoção | 0 | Relacionamentos consistentes são requisito de qualidade |
| 21 | orders | Pedidos sem nenhum item | Mantidos (não entram em receita) | 775 | Pedidos cancelados/indisponíveis frequentemente não têm itens |

## Premissas e limitações

- Valores ausentes **não são imputados**: permanecem nulos (ex.: datas de entrega, dimensões de produtos, comentários de avaliação).
- Pedidos sem data efetiva de entrega não recebem prazo de entrega.
- Receita = soma de `price` dos itens (sem frete) de pedidos não cancelados/indisponíveis. Receita **não** é lucro: o dataset não tem custos.
- Registros com problemas de integridade referencial são **sinalizados** nos logs, mas mantidos quando o problema não invalida a própria linha.
- O dataset é uma amostra pública de um marketplace (2016 a 2018), não toda a operação de um varejista.
