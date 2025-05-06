const apiBaseUrl = window.location.origin; // Set to current origin

const formBuscar = document.getElementById("form-buscar");
const formAtualizar = document.getElementById("form-atualizar");

let produtoId = null;

formBuscar.addEventListener("submit", async (e) => {
  e.preventDefault();

  const sku = document.getElementById("sku").value;

  try {
    const resposta = await fetch(`${apiBaseUrl}/buscar-produto/${sku}`);
    const dados = await resposta.json();

    if (!dados.retorno || !dados.retorno.produto) {
      throw new Error("Produto não encontrado");
    }

    const produto = dados.retorno.produto;

    document.getElementById("info-produto").style.display = "block";
    document.getElementById("nome-produto").innerText = produto.nome;
    document.getElementById("localizacao-atual").innerText = produto.localizacao?.trim() || "(vazio)";
    
    const imagemEl = document.getElementById("imagem-produto");
    
    // Improved image handling
    if (produto.imagem) {
      imagemEl.src = produto.imagem;
      imagemEl.style.display = "block";
      console.log("Image URL:", produto.imagem);
    } else {
      imagemEl.style.display = "none";
      console.log("No image available for this product");
    }

    produtoId = produto.id;
  } catch (erro) {
    console.error("Error:", erro);
    alert("Erro ao buscar produto! " + erro.message);
  }
});

formAtualizar.addEventListener("submit", async (e) => {
  e.preventDefault();

  const localizacao = document.getElementById("localizacao").value;

  if (!produtoId) {
    alert("Nenhum produto selecionado!");
    return;
  }

  try {
    const resposta = await fetch(`${apiBaseUrl}/atualizar-localizacao`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ produtoId, localizacao }),
    });

    const dados = await resposta.json();
    document.getElementById("mensagem").innerText = dados.mensagem;
    document.getElementById("localizacao-atual").innerText = localizacao;
  } catch (erro) {
    console.error(erro);
    alert("Erro ao atualizar localização!");
  }
});