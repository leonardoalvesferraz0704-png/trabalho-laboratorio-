export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const nome = url.searchParams.get("aluno") || "";
  const resultado = await context.env.DB.prepare(`SELECT * FROM notas WHERE aluno = '${nome}'`).all();
  return Response.json(resultado.results);
}