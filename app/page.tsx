import Formulario from "@/components/Formulario";
import { LogoHorizontal } from "@/components/Marca";

export default function Pagina() {
  return (
    <>
      <div className="cielo" />
      <div className="capa">
        <header className="barra">
          <div className="barra-interior">
            <LogoHorizontal tamano={30} />
            <span className="rotulo">Kit de postulación</span>
          </div>
        </header>

        <main className="lienzo">
          <Formulario />
        </main>
      </div>
    </>
  );
}
