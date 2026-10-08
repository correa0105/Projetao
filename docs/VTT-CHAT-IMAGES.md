# Imagens no chat do VTT

Envie `(Texto)[https://endereço-da-imagem]`. A forma `[Texto](https://endereço-da-imagem)`
também funciona. Texto livre pode aparecer antes, entre e depois das imagens.
URLs HTTPS de CDN sem extensão e com parâmetros são aceitas; caminhos locais
começando por uma barra também. Links externos HTTP não combinam com a CSP atual.

Parser em shared/vtt-chat-images.ts; render React escapado em VttChatText.tsx,
sem HTML arbitrário, eval, download de servidor ou proxy. Protocolos executáveis,
data/file, credenciais e URLs relativas a protocolo ficam como texto literal.
Imagem tem legenda/alt, pré-carregamento lazy, max-width do painel, abertura
externa segura e fallback clicável se falhar. Texto da mensagem original persiste.
Carregar mídia só segue o fim do chat se o usuário já estiver no final.

Testes cobrem ambas as sintaxes, texto misto, múltiplas imagens e URLs inseguras.

## Descrições de arma e magia (08/10/2026)

Jogadores podem usar `/arma Espada longa | Dano: 1d8 cortante. Alcance: 1,5 m.`
ou `/magia Raio de fogo | Descrição do ataque e seus efeitos.`. Os botões **Arma**
e **Ataque de magia** junto à mensagem inserem modelos e conservam o rascunho.
Quebras de linha, texto livre e imagens são aceitos dentro da descrição. Os
comandos geram cartões no chat compartilhado, sem executar HTML ou aplicar regras.
Nome vazio, descrição vazia e comando inválido permanecem como texto literal.
Mensagem original e privacidade persistem como antes.
