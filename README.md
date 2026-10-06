# Banco Inverter

Guia de banco para reparar placas inverter de minisplit a nivel componente.
PWA instalable: se abre sin internet una vez visitada.

## Compilar

La pagina se genera desde `source/banco-inverter.html` (la version del artifact):

    node tools/make-icons.js   # solo si cambian los iconos
    node tools/build.js        # genera index.html y sw.js

Publicado en GitHub Pages desde la rama main.
