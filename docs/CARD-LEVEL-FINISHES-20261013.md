# Cartas simbólicas, moldura compartilhada e três acabamentos

As oito cartas seguem a referência mais recente: ilustração simbólica plana em
pergaminho, tinta violeta e acentos discretos. Nível visual 2 usa a mesma composição
em preto, branco e dourado. Nível 3 acrescenta acabamento metálico na moldura e
reflexos estáticos suaves sobre a arte. Cromado continua reservado para o futuro.

Todas as raridades compartilham a mesma geometria de moldura. A raridade é indicada
somente na descrição; ao passar o mouse ou focar com teclado, aparece um contorno
verde. Os antigos halos e partículas de raridade foram retirados.

O nível possuído determina a aparência em catálogo, equipadas, coleção e perfil.
Os três botões de Prévia permitem comparar acabamentos e inspecioná-los ampliados,
sem modificar o nível possuído. A forma de evolução ainda aguarda definição do
usuário. Níveis antigos superiores a 3 usam o visual de ápice, sem alterar o banco.
Preços, raridades, disponibilidade, compras, ouro e equipamento são preservados.

Títulos são HTML, proporcionais à largura da carta, inteiros e centralizados na
faixa inferior. A moldura única em src/CardFrame.tsx garante a consistência e
permite acabamento metálico sem gerar novas texturas nem manter animação ativa.

Image_gen embutido: oito gerações para o nível 1 e oito edições para o nível 2,
preservando cada composição. Fontes em data/cards/tarot-symbolic-sources-20261013;
WebPs em public/cards/tarot-symbolic-20261013. Prompts finais e hashes em
data/cards/tarot-symbolic-reviewed-20261013.json. O nível 3 reutiliza a ilustração
do nível 2 com acabamento no renderer.

As oito cartas de vidraça e as oito antigas foram copiadas e verificadas por hash
na Área de Trabalho, pasta Cartas de Vidraça - 13-10-2026, com subpasta Antigas.
Artes anteriores e arquivos do projeto são conservados. As quatro pinturas
descartadas não foram publicadas; A Torre não entrou no catálogo.

QA: TypeScript/build, dezesseis mídias/decodificação, moldura idêntica entre raridades,
contorno verde, três acabamentos e ausência de animação contínua; navegador real em
cinco viewports confere nomes completos, quatro cartas por página, inspeção/blur,
prévia e níveis possuídos inalterados. Publicação local preserva mídias e registros
anteriores e usa somente o cliente novo, sem migrations ou alteração do servidor.
