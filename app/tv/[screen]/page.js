import TvDisplay from "../TvDisplay";

// /tv/<slug-do-restaurante> — cada Fully Kiosk aponta para o seu.
// Mostra os itens desse restaurante + os itens globais (sem restaurante).
export default async function TvScreenPage({ params }) {
  const { screen } = await params;
  return <TvDisplay screenSlug={screen} />;
}
