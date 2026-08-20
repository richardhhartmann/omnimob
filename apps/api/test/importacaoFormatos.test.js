import test from "node:test";
import assert from "node:assert/strict";
import { lerFonte, ErroDeFormato } from "../src/services/formatosImportacao.js";

/* ────────────────────────────────────────────────────────────────────────────
   O que acontece quando o feed do outro lado não é o que a gente imaginou.

   Esta suíte não toca no banco — é a segunda da API assim, junto com a da IA da
   vitrine, e pela mesma razão: o risco aqui não é vazamento entre imobiliárias,
   é INTERPRETAÇÃO. Um parser que lê o preço da tag errada não quebra nada; ele
   importa quinhentos imóveis com o valor errado, em silêncio, e o defeito
   aparece quando um cliente ligar perguntando pelo apartamento de R$ 3.

   Por isso os casos abaixo são quase todos formas de estar errado: um imóvel
   só (que o parser transformaria em objeto em vez de lista), aluguel (que põe o
   preço em outra tag), tipo aninhado em tags vazias, vídeo misturado às fotos,
   HTML devolvido por uma URL de login.
   ──────────────────────────────────────────────────────────────────────────── */

const VRSYNC_UM = `<?xml version="1.0" encoding="UTF-8"?>
<ListingDataFeed xmlns="http://www.vivareal.com/schemas/1.0/VRSync">
  <Header><Provider>Sistema Antigo</Provider></Header>
  <Listings>
    <Listing>
      <ListingID>AP-1042</ListingID>
      <Title>Apartamento no Centro</Title>
      <TransactionType>For Sale</TransactionType>
      <Details>
        <PropertyType><Residential><Apartment/></Residential></PropertyType>
        <Description><![CDATA[Vista livre & sol da manhã]]></Description>
        <ListPrice currency="BRL">350000</ListPrice>
        <Bedrooms>3</Bedrooms>
        <Suites>1</Suites>
        <Garage>2</Garage>
        <LivingArea>78</LivingArea>
      </Details>
      <Location>
        <State>SP</State>
        <City>São Paulo</City>
        <Neighborhood>Centro</Neighborhood>
        <Address>Rua A, 100</Address>
        <PostalCode>01310100</PostalCode>
      </Location>
      <Media>
        <Item medium="image" primary="true">https://antigo.com/1.jpg</Item>
        <Item medium="video">https://youtube.com/watch?v=x</Item>
        <Item medium="image">https://antigo.com/2.jpg</Item>
      </Media>
    </Listing>
  </Listings>
</ListingDataFeed>`;

test("VRSync: um imóvel só continua sendo uma lista", () => {
  /* O parser devolve objeto para um nó e array para vários. Sem forçar a lista,
     um feed de um imóvel importaria zero — e o cliente que testou a migração
     com um anúncio concluiria que a integração não funciona. */
  const { formato, linhas } = lerFonte(VRSYNC_UM, "imoveis");
  assert.equal(formato, "vrsync");
  assert.equal(linhas.length, 1);
});

test("VRSync: os campos caem nos nossos nomes", () => {
  const [imovel] = lerFonte(VRSYNC_UM, "imoveis").linhas;
  assert.equal(imovel.origemExterna, "AP-1042");
  assert.equal(imovel.title, "Apartamento no Centro");
  assert.equal(imovel.price, "350000");
  assert.equal(imovel.city, "São Paulo");
  assert.equal(imovel.neighborhood, "Centro");
  assert.equal(imovel.cep, "01310100");
  assert.equal(imovel.bedrooms, "3");
  assert.equal(imovel.parkingSpots, "2");
  assert.equal(imovel.tipoContrato, "VENDA");
});

test("VRSync: o CDATA chega inteiro, com o & no meio", () => {
  const [imovel] = lerFonte(VRSYNC_UM, "imoveis").linhas;
  assert.equal(imovel.description, "Vista livre & sol da manhã");
});

test("VRSync: o tipo sai das tags vazias aninhadas e vem traduzido", () => {
  /* `<PropertyType><Residential><Apartment/></Residential></PropertyType>` não
     tem texto nenhum: o tipo é o NOME do elemento. Ler com um leitor de texto
     devolveria vazio, e todo imóvel importado ficaria sem tipo. */
  const [imovel] = lerFonte(VRSYNC_UM, "imoveis").linhas;
  assert.equal(imovel.tipoImovel, "Apartamento");
});

test("VRSync: vídeo não entra na galeria de fotos", () => {
  /* Sem o filtro por `medium`, a URL do YouTube entraria como foto — e o
     Cloudinary devolveria erro no meio da importação, para uma linha que nem
     deveria ter sido tentada. */
  const [imovel] = lerFonte(VRSYNC_UM, "imoveis").linhas;
  assert.deepEqual(imovel.fotos, ["https://antigo.com/1.jpg", "https://antigo.com/2.jpg"]);
});

test("VRSync: aluguel lê o preço da OUTRA tag", () => {
  /* Um feed de locação não tem `ListPrice` nenhum. Ler só ele importaria a
     carteira inteira com preço ausente — e cada linha seria recusada por
     "preço ilegível", o que parece defeito nosso. */
  const aluguel = VRSYNC_UM
    .replace("<TransactionType>For Sale</TransactionType>", "<TransactionType>For Rent</TransactionType>")
    .replace('<ListPrice currency="BRL">350000</ListPrice>', '<RentalPrice currency="BRL">2500</RentalPrice>');
  const [imovel] = lerFonte(aluguel, "imoveis").linhas;
  assert.equal(imovel.price, "2500");
  assert.equal(imovel.tipoContrato, "LOCACAO");
});

test("VRSync: prefixo de namespace não muda o resultado", () => {
  // Exportadores diferentes usam `<vr:Listing>` ou `<Listing>` para a mesma
  // coisa. Tratar as duas grafias dobraria cada caminho por nada.
  const comPrefixo = VRSYNC_UM
    .replace(/<Listing>/g, "<vr:Listing>")
    .replace(/<\/Listing>/g, "</vr:Listing>")
    .replace("<ListingDataFeed ", "<vr:ListingDataFeed ")
    .replace("</ListingDataFeed>", "</vr:ListingDataFeed>")
    .replace("<Listings>", "<vr:Listings>")
    .replace("</Listings>", "</vr:Listings>");
  const { linhas } = lerFonte(comPrefixo, "imoveis");
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].origemExterna, "AP-1042");
});

test("VRSync recusado para clientes, com o motivo dito", () => {
  /* O esquema não tem cliente nenhum. A mensagem precisa dizer o que fazer em
     vez de "formato inválido" — é aqui que a pessoa descobre que a carteira
     entra por outro caminho. */
  assert.throws(
    () => lerFonte(VRSYNC_UM, "clientes"),
    (erro) => erro instanceof ErroDeFormato && /só descreve imóveis/i.test(erro.message),
  );
});

test("XML da Omnimob: clientes, com as fotos fora do caminho", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<omnimob>
  <clientes>
    <cliente><nome>Ana Prado</nome><cpf>12345678900</cpf><email>ana@x.com</email><origemExterna>C-1</origemExterna></cliente>
    <cliente><nome>Bruno Sá</nome><whatsapp>11999998888</whatsapp></cliente>
  </clientes>
</omnimob>`;
  const { formato, linhas } = lerFonte(xml, "clientes");
  assert.equal(formato, "omnimob");
  assert.equal(linhas.length, 2);
  assert.equal(linhas[0].nome, "Ana Prado");
  assert.equal(linhas[0].origemExterna, "C-1");
  assert.equal(linhas[1].whatsapp, "11999998888");
});

test("JSON: aceita a lista crua e a lista embrulhada", () => {
  const cru = JSON.stringify([{ nome: "Ana" }, { nome: "Bruno" }]);
  assert.equal(lerFonte(cru, "clientes").linhas.length, 2);

  // O formato que a nossa própria API devolve, para o ciclo fechar.
  const embrulhado = JSON.stringify({ total: 1, clientes: [{ nome: "Ana" }] });
  assert.equal(lerFonte(embrulhado, "clientes").linhas.length, 1);
});

test("a linha de origem acompanha cada registro", () => {
  /* `__linha` é o que faz o relatório de erros dizer "linha 37: preço ausente".
     Sem ela, trezentos erros seriam trezentas frases sem endereço. */
  const { linhas } = lerFonte(JSON.stringify([{ nome: "A" }, { nome: "B" }]), "clientes");
  assert.equal(linhas[0].__linha, 1);
  assert.equal(linhas[1].__linha, 2);
});

test("HTML no lugar do feed vira erro que diz onde olhar", () => {
  /* A causa mais comum de "não reconheci o formato" não é um XML exótico: é a
     URL devolver a página de login do sistema antigo, com status 200. */
  const html = "<html><body><h1>Faça login</h1></body></html>";
  assert.throws(
    () => lerFonte(html, "imoveis"),
    (erro) => erro instanceof ErroDeFormato && /html/i.test(erro.message),
  );
});

test("resposta vazia é erro tratado, não exceção crua", () => {
  assert.throws(() => lerFonte("", "imoveis"), (e) => e instanceof ErroDeFormato);
  assert.throws(() => lerFonte("   ", "imoveis"), (e) => e instanceof ErroDeFormato);
});

test("JSON quebrado não derruba o processo", () => {
  assert.throws(
    () => lerFonte('{"clientes": [', "clientes", "application/json"),
    (erro) => erro instanceof ErroDeFormato && /json/i.test(erro.message),
  );
});
