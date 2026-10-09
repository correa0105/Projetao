# Compatibilidade de abas antigas do VTT

A conjuração salva alterações pendentes da mesa antes de preparar a magia.
Uma aba com o schema anterior aos campos bloodEnabled e automaticDeath rejeitava
esses campos localmente e exibia o JSON de Zod. O protocolo 4 identifica abas
antigas também em leituras e em comandos, antes de devolver documentos com campos
novos. O aviso orienta recarregar e mantém os dados salvos. Ausência de cabeçalho
continua permitida para imagens e integrações de leitura existentes; PUT integral
continua exigindo o protocolo atual.

Erros locais de validação ao preparar/confirmar/encerrar magias recebem o mesmo
aviso claro. Os avisos de mesa e de magia oferecem Recarregar VTT. Uma aba que já
estava aberta precisa de Ctrl + F5 uma vez para carregar esse código.

Validação em PostgreSQL descartável e navegador: aba de protocolo 3 recebe 409
com aviso de atualização ao ler a sala; mestre desmarca sangue e morte automática,
prepara e conjura Blur, e as duas escolhas continuam salvas. A suíte também
verifica consumo atômico de espaços, idempotência, ownership, alvos ocultos,
revogação de mestre, concentração, recarga, áreas/níveis e quatro larguras.
TypeScript e builds do cliente e servidor passaram. Não há migração nesta correção.

Os tokens de animais e as melhorias de arte continuam em desenvolvimento separado.
O protótipo pausado dos 330 monstros não integra este release.
