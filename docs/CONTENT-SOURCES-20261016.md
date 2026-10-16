# Fontes permitidas — 16/10/2026

Arcana Unleashed (AU) foi retirado a pedido do usuário. Tasha's Cauldron of Everything (TCE) continua permitido; suas nove opções de magia já presentes na configuração da loja permanecem disponíveis.

O catálogo de fichas passa a 68 subclasses, 411 magias e 204 planos de Artífice. Os IDs do SRD anterior permanecem. Os importadores e geradores filtram AU antes de selecionar versões ou republicar conteúdo. O corte de revisão dos demais suplementos permanece o mesmo; não foram acrescentadas subclasses legadas de Tasha nesta alteração.

A migration 098 apenas desativa vendas de AU e seus componentes. O seed aplica a mesma política para não reativar os produtos. Registros de catálogo são conservados para inventários, equipamentos, compras e auditoria. Não há exclusão ou conversão de personagens, nem alteração de seus dados salvos. Escolhas antigas continuam registradas, mas opções retiradas deixam de fornecer regras e novas seleções.

Na retomada também foram corrigidos, na pasta de validação dos assets, a inferência de janelas vazias e o posicionamento do botão de porta em casas de bioma sem `doorVisual`. O botão usa a entrada definida no footprint. Esse trabalho permanece separado da publicação das fontes: o lote de 142 assets ainda está incompleto.

Validação: regressão das fichas em PostgreSQL UUID descartável, testes da política e rejeição de subclasse retirada enviada diretamente ao servidor, TypeScript e builds de cliente/servidor. O release é preparado a partir do commit publicado, preservando os arquivos anteriores e excluindo alterações independentes ainda em andamento.
