// obtener elementos del DOM
const BODY = document.body,
  DEPARTAMENTOS = document.getElementById("departamentos"),
  FORMULARIO = document.getElementById("fomulario"),
  LOCALIZACION = document.getElementById("localizacion"),
  PALABRA_CLAVE = document.getElementById("palabra-clave"),
  BOTON_BUSCAR = document.getElementById("boton-buscar"),
  BOTON_LIMPIAR = document.getElementById("boton-limpiar-filtros");

// objetos útiles
const arrGrillasIDs = [],
  arrGrillasCartas = [],
  controllerObras = {};

// obtener y colocar departamentos en el select "departamentos"
async function colocarDepartamentos() {
  // obtener departamentos traducidos al español
  try {
    const response = await fetch('http://localhost:3000/obtenerDepartamentos');
    const departamentos = await response.json();

    // colocar opción "sin especificar" en el select
    const OPTION = document.createElement("option");
    OPTION.value = -1;
    OPTION.innerHTML = "Sin especificar";
    OPTION.selected = true;
    DEPARTAMENTOS.appendChild(OPTION);

    // agregar departamentos al select "departamentos"
    for (const depto of departamentos) {
      const OPTION = document.createElement("option");
      OPTION.value = depto.departmentId;
      OPTION.innerHTML = depto.displayName;
      DEPARTAMENTOS.appendChild(OPTION);
    }

    // mostrar formulario
    FORMULARIO.style.display = 'block';

    // sacar mensaje de "cargando información"
    const mensajeCargando = document.getElementById("mensaje-cargando-informacion");
    BODY.removeChild(mensajeCargando);

  } catch (error) {
    const mensajeCargando = document.getElementById("mensaje-cargando-informacion");
    const mensajeError = document.createElement('p')

    // crear y colocar mensaje de error    
    const mensajeErrorCarga = document.createElement("p");
    mensajeErrorCarga.id = "mensaje-entrada-incorrecta";
    mensajeErrorCarga.innerHTML = "Se ha producido un error al obtener datos desde el servidor. Por favor, vuelva a cargar la página.";

    BODY.replaceChild(mensajeErrorCarga, mensajeCargando);
  }

}

// resaltar entrada con contenido erróneo y mostrar mensaje de error
function indicarError() {
  // modificar entrada "palabra clave"
  PALABRA_CLAVE.classList.add("entrada-erronea");

  // crear y colocar mensaje de error    
  const mensajeEntradaIncorrecta = document.createElement("p");
  mensajeEntradaIncorrecta.id = "mensaje-entrada-incorrecta";
  mensajeEntradaIncorrecta.innerHTML = "La palabra clave debe ser una única palabra (sin espacios de por medio).";
  FORMULARIO.insertAdjacentElement("afterend", mensajeEntradaIncorrecta);
}

// resaltar que se está realizando una búsqueda
function indicarBusqueda() {
  // crear y colocar mensaje de búsqueda    
  const mensajeBusquedaEnEjecucion = document.createElement("p");
  mensajeBusquedaEnEjecucion.id = "mensaje-busqueda-ejecucion";
  mensajeBusquedaEnEjecucion.innerHTML = "Se están obteniendo las obras";

  // actualizar mensaje cada segundo
  const intervalo = setInterval(() => {
    if (mensajeBusquedaEnEjecucion !== undefined) {
      // el mensaje permanece

      // cambiar mensaje
      if (mensajeBusquedaEnEjecucion.innerHTML.slice(-3) !== '...') {
        mensajeBusquedaEnEjecucion.innerHTML += '.';
      } else {
        mensajeBusquedaEnEjecucion.innerHTML = "Se están obteniendo las obras";
      }
    } else {
      // se quitó el mensaje
      clearInterval(intervalo);
    }
  }, 1000);
  FORMULARIO.insertAdjacentElement("afterend", mensajeBusquedaEnEjecucion);
}

// realizar búsqueda y mostrar obras obtenidas
async function mostrarResultados() {
  quitarResultados();

  // configurar página según haya error en la entrada o no (palabra clave debe ser una palabra)
  const palabraClave = PALABRA_CLAVE.value.trim(),
    localizacion = LOCALIZACION.value.trim();
  LOCALIZACION.value = localizacion;

  if (palabraClave.search(/(\s)+/) != -1) {
    // palabra inválida

    // posibilitar que el usuario haga una nueva búsqueda (aunque sea sin haber cambiado ningún campo)
    BOTON_BUSCAR.disabled = false;

    // si ya se indica un error, dejarlo todo como está y retornar
    if (document.getElementById("mensaje-entrada-incorrecta")) {
      return;
    }

    indicarError();
    return;
  } else {
    // palabra válida

    // si aún se indica un error (aunque no existe actualmente), corregir
    const mensajeEntradaIncorrecta = document.getElementById("mensaje-entrada-incorrecta");
    if (mensajeEntradaIncorrecta) {
      mensajeEntradaIncorrecta.remove();
      PALABRA_CLAVE.classList.remove("entrada-erronea");
    }

    // colocar mensaje de "cargando"
    indicarBusqueda();
  }

  // preparar filtros para la búsqueda
  const filtros = {
    departamento: DEPARTAMENTOS.value,
    localizacion: localizacion,
    palabraClave: palabraClave
  };

  const responseIDs = await fetch('http://localhost:3000/obtenerIDs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filtros),
  });
  const resultadoIDs = await responseIDs.json();

  // posibilitar que el usuario haga una nueva búsqueda (aunque sea sin haber cambiado ningún campo)
  BOTON_BUSCAR.disabled = false;

  // en caso de que no se haya encontrado nada, actualizar correspondientemente
  if (resultadoIDs.total === 0) {
    // sacar mensaje de búsqueda en ejecución
    const mensajeBusquedaEnEjecucion = document.getElementById("mensaje-busqueda-ejecucion");
    if (mensajeBusquedaEnEjecucion) {
      mensajeBusquedaEnEjecucion.remove();
    }

    const mensaje = document.createElement("p");
    mensaje.id = "mensaje-cero-resultados";
    mensaje.innerHTML = "No se encontraron resultados que coincidan con los filtros ingresados";
    BODY.appendChild(mensaje);

    // posibilitar que el usuario haga una nueva búsqueda (aunque sea sin haber cambiado ningún campo)
    BOTON_BUSCAR.disabled = false;

    return;
  }

  // preparar los ID's a consultar
  const datos = {
    ids: resultadoIDs.objectIDs
  };

  // posibilitar que se cancele la búsqueda de los objetos 
  controllerObras.controller = new AbortController();
  controllerObras.signal = controllerObras.controller.signal;

  const responseObras = await fetch('http://localhost:3000/obtenerObras', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
    signal: controllerObras.signal
  });
  const resultadoObras = await responseObras.json();

  // crear cartas para las obras obtenidas
  const cantGrillas = Math.ceil(resultadoObras.length / 20),
    cantFilas = Math.ceil(resultadoObras.length / 4),
    cantFilasUltimaGrilla = cantFilas % 5 || 5,
    cantObrasUltimaFila = resultadoObras.length % 4 || 4;

  // crear grillas, filas de cartas y cartas
  for (let i = 0; i < cantGrillas; i++) {
    // la cantidad de filas podría ser menor a 5 en la última grilla
    const grilla = [];
    const cantFilasGrillaActual = (i === cantGrillas - 1) ? cantFilasUltimaGrilla : 5;

    for (let j = 0; j < cantFilasGrillaActual; j++) {
      // la cantidad de obras podría ser menor que 4 en la última fila de la última grilla
      const cantObrasFilaActual = ((i === cantGrillas - 1) && (j === cantFilasUltimaGrilla - 1)) ? cantObrasUltimaFila : 4;

      // crear fila
      const filaDeCartas = document.createElement("div");
      filaDeCartas.classList.add("fila-cartas");

      for (let k = 0; k < cantObrasFilaActual; k++) {
        // armar carta
        const carta = document.createElement("div");
        carta.classList.add("carta");

        agregarImagenACarta(carta, resultadoObras[i * 20 + j * 4 + k]);
        agregarDatosACarta(carta, resultadoObras[i * 20 + j * 4 + k]);
        agregarBotonImgAdicionales(carta, resultadoObras[i * 20 + j * 4 + k]);

        filaDeCartas.appendChild(carta);
      }

      grilla.push(filaDeCartas);
    }

    arrGrillasCartas.push(grilla);
  }

  // sacar mensaje de búsqueda en ejecución
  const mensajeBusquedaEnEjecucion = document.getElementById("mensaje-busqueda-ejecucion");
  if (mensajeBusquedaEnEjecucion) {
    mensajeBusquedaEnEjecucion.remove();
  }

  // colocar cartas de la primera grilla en el DOM
  for (const fila of arrGrillasCartas[0]) {
    BODY.appendChild(fila);
  }

  // colocar índices
  const indiceSup = crearIndice(0),
    indiceInf = crearIndice(0);

  FORMULARIO.insertAdjacentElement("afterend", indiceSup);
  BODY.appendChild(indiceInf);
}

// cambiar la grilla mostrada actualmente y también actualizar el índice
async function cambiarGrilla(index) {
  // borrar resultados anteriores
  sacarComponentes();

  // obtener cartas de la grilla indicada
  const arrFilCartas = arrGrillasCartas[index];

  // colocar en el DOM
  for (const fila of arrFilCartas) {
    BODY.appendChild(fila);
  }

  // colocar índices
  const indiceSup = crearIndice(index),
    indiceInf = crearIndice(index);

  FORMULARIO.insertAdjacentElement("afterend", indiceSup);
  BODY.appendChild(indiceInf);
}

// sacar grilla e índice o mensaje de "no hay resultados" actuales
function sacarComponentes() {
  // cancelar la obtención de objetos (objetos; no IDs) 
  if (controllerObras.controller !== undefined) {
    // no es la primera vez que se está intentando obtener objetos en la búsqueda actual (cambio de grilla)
    controllerObras.controller.abort('Obtención de obras interrumpida por nueva búsqueda');
  }

  // sacar obras mostradas, si las hubiera
  const listaFilas = document.querySelectorAll(".fila-cartas").values();
  for (const fila of listaFilas) {
    BODY.removeChild(fila);
  }

  // remover índices, si los hubiera
  const indices = document.getElementsByClassName("indice");
  const cantIndices = indices.length;
  for (let i = 0; i < cantIndices; i++) {
    indices[0].remove();
  }

  // sacar mensaje de "no hay resultados", si lo hubiera
  const mensajeNoHayResultados = document.getElementById("mensaje-cero-resultados");
  if (mensajeNoHayResultados) {
    BODY.removeChild(mensajeNoHayResultados);
  }

  // sacar mensaje de "búsqueda en ejecución", si lo hubiera
  const mensajeBusquedaEnEjecucion = document.getElementById("mensaje-busqueda-ejecucion");
  if (mensajeBusquedaEnEjecucion) {
    BODY.removeChild(mensajeBusquedaEnEjecucion);
  }
}

// borrar todo lo referido a los resultados anteriores, excepto el contenido de las entradas (que ahora tienen el contenido referido a la nueva búsqueda)
function quitarResultados() {
  sacarComponentes();

  // borrar cartas construidas a partir de las obras obtenidas en la búsqueda anterior
  arrGrillasCartas.length = 0;
}

// crear/cambiar índice, luego de que se realizó una búsqueda o se cambió de grilla
function crearIndice(index) {
  // crear contenedor de índice
  const indice = document.createElement("div");
  indice.classList.add("indice");

  // determinar vínculos a crear
  const cantGrillas = arrGrillasCartas.length;
  let grillaActual = index + 1,
    cantGrillasDerecha = cantGrillas - grillaActual,
    cantGrillasIzquierda = grillaActual - 1;

  // crear span's que se vinculen a las distintas grillas a la izq. de la elegida
  if (cantGrillasIzquierda < 4) {
    for (let i = 0; i < cantGrillasIzquierda; i++) {
      crearVinculoParaIndice(indice, i);
    }
  } else {
    // agregar vínculo a la primera grilla al índice y 3 puntos 
    crearVinculoParaIndice(indice, 0);
    const tresPuntos = document.createElement("span");
    /* tresPuntos.classList.add("indice"); */
    tresPuntos.innerHTML = "...";
    indice.appendChild(tresPuntos);

    // agregar al índice vínculos a las primeras 2 grillas inmediatamente a la izq. de la grilla actual
    for (let i = grillaActual - 3; i < grillaActual - 1; i++) {
      crearVinculoParaIndice(indice, i);
    }
  }

  // crear span que se vincule a la grilla actual 
  // nota: se resta 1 a grillaActual dado que la función trabaja con la posición en el arreglo de la grilla 
  // (una unidad menor que el número de la grilla)
  crearVinculoParaIndiceGrillaActual(indice, grillaActual - 1);

  // crear span's que se vinculen a las distintas grillas a la der. de la elegida
  if (cantGrillasDerecha < 4) {
    for (let i = grillaActual; i < cantGrillas; i++) {
      crearVinculoParaIndice(indice, i);
    }
  } else {
    // agregar al índice vínculos a las primeras 2 grillas inmediatamente a la der. de la grilla actual
    for (let i = grillaActual; i < grillaActual + 2; i++) {
      crearVinculoParaIndice(indice, i);
    }

    // agregar 3 puntos y vínculo a la última grilla al índice    
    const tresPuntos = document.createElement("span");
    /* tresPuntos.classList.add("indice"); */
    tresPuntos.innerHTML = "...";
    indice.appendChild(tresPuntos);
    crearVinculoParaIndice(indice, cantGrillas - 1);
  }

  return indice;
}

// crear vínculo para una grilla distinta de la elegida
function crearVinculoParaIndice(indice, i) {
  const vinculo = document.createElement("span");
  vinculo.classList.add("enlace-grilla");
  vinculo.innerHTML = i + 1;
  vinculo.addEventListener("click", () => cambiarGrilla(i));
  indice.appendChild(vinculo);
}

// crear span para la grilla elegida
function crearVinculoParaIndiceGrillaActual(indice, i) {
  const vinculo = document.createElement("span");
  vinculo.classList.add("enlace-grilla");
  vinculo.id = "indice-actual";
  vinculo.innerHTML = i + 1;
  indice.appendChild(vinculo);
}

// crear grillas y filas a partir de ID's (POTENCIALMENTE OBSOLETO)
function crearGrillasDeIDs(arrIDResultados) {
  const cantFilas = Math.floor(arrIDResultados.length / 4) + 1,
    cantGrillas = Math.floor(arrIDResultados.length / 20) + 1;
  for (let i = 0; i < cantGrillas; i++) {
    // determinar la cantidad de filas que debe haber en la grilla actual
    let limInfFilas = 5 * i,
      limSupFilas;
    if (i <= (cantGrillas - 2)) {
      limSupFilas = limInfFilas + 5;
    } else {
      limSupFilas = cantFilas;
    }

    crearFilasDeIDs(arrIDResultados, cantFilas, limInfFilas, limSupFilas);
  }
}

// (POTENCIALMENTE OBSOLETO)
function crearFilasDeIDs(arrIDResultados, cantFilas, limInfFilas, limSupFilas) {
  const arrFilas = [];
  for (let j = limInfFilas; j < limSupFilas; j++) {
    // crear fila de ID's
    const filaIDs = [];

    // determinar la cantidad de ID's que debe tener la fila actual
    let limInfObras = 4 * j,
      limSupObras;
    if (j <= (cantFilas - 2)) {
      limSupObras = limInfObras + 4;
    } else {
      limSupObras = arrIDResultados.length;
    }

    // agregar ID's a fila
    for (let k = limInfObras; k < limSupObras; k++) {
      filaIDs.push(arrIDResultados[k]);
    }

    // agregar fila al arreglo de las filas de la grilla actual
    arrFilas.push(filaIDs);
  }
  arrGrillasIDs.push(arrFilas);
}

// crear e insertar imágen en carta
function agregarImagenACarta(carta, obra) {
  const imgObra = document.createElement("img");
  if (obra.primaryImage === "") {
    imgObra.src = './imágenes/imagen-no-disponible.png';
  } else {
    imgObra.src = obra.primaryImage;
  }

  imgObra.alt = obra.title;

  // incluir fecha de origen de la obra al posar el mouse sobre la imagen
  imgObra.addEventListener("mousemove", e => {  // TODO: probar mouseover
    let fechaOrigenObra = document
      .getElementById("fecha-origen-obra");

    if (!fechaOrigenObra) {
      // crear, configurar y anexar componente
      fechaOrigenObra = document.createElement("div");
      fechaOrigenObra.id = "fecha-origen-obra";
      carta.appendChild(fechaOrigenObra);
    }

    // actualizar fecha
    fechaOrigenObra.replaceChildren();
    const pFecha = document.createElement("p");
    pFecha.innerHTML = `Fecha de origen de la obra: ${obra.objectDate}`;
    fechaOrigenObra.appendChild(pFecha);

    // reubicar "tooltip" en el lugar adecuado
    fechaOrigenObra.style.display = "block";
    fechaOrigenObra.style.left = `${Number(e.clientX) - 100}px`;
    fechaOrigenObra.style.top = `${Number(e.clientY) + 50}px`;
  });

  // ocultar fecha de origen de la obra al sacar el mouse de la imagen
  imgObra.addEventListener("mouseout", () => {
    const fechaOrigenObra = document.getElementById("fecha-origen-obra");
    fechaOrigenObra.style.display = "none";
  });

  carta.appendChild(imgObra);
}

// agregar título a datos de la obra
function agregarTituloADatos(contenedorCaracteristicas, obra) {
  // crear contenedor del dato título
  const parCaracteristicaValorTitulo = document.createElement("div");
  parCaracteristicaValorTitulo.classList.add("par-caracteristica-valor");

  // crear contenedor del tipo del dato, agregar contenido y anexar al contenedor del dato título
  const caracteristicaTitulo = document.createElement("div");
  caracteristicaTitulo.classList.add("caracteristica");
  const pTipoDatoTitulo = document.createElement("p");
  pTipoDatoTitulo.innerHTML = "Título:";
  caracteristicaTitulo.appendChild(pTipoDatoTitulo);
  parCaracteristicaValorTitulo.appendChild(caracteristicaTitulo);

  // crear contenedor del valor del dato, agregar contenido y anexar al contenedor del dato título
  const valorTitulo = document.createElement("div");
  valorTitulo.classList.add("valor");
  const pValorDatoTitutlo = document.createElement("p");
  pValorDatoTitutlo.innerHTML = obra.title;
  valorTitulo.appendChild(pValorDatoTitutlo);
  parCaracteristicaValorTitulo.appendChild(valorTitulo);

  // anexar el contenedor del dato título al contenedor de datos de la obra
  contenedorCaracteristicas.appendChild(parCaracteristicaValorTitulo);
}

// agregar cultura a datos de la obra
function agregarCulturaADatos(contenedorCaracteristicas, obra) {
  // crear contenedor del dato cultura
  const parCaracteristicaValorCultura = document.createElement("div");
  parCaracteristicaValorCultura.classList.add("par-caracteristica-valor");

  // crear contenedor del tipo del dato, agregar contenido y anexar al contenedor del dato cultura        
  const caracteristicaCultura = document.createElement("div");
  caracteristicaCultura.classList.add("caracteristica");
  const pTipoDatoCultura = document.createElement("p");
  pTipoDatoCultura.innerHTML = "Cultura:";
  caracteristicaCultura.appendChild(pTipoDatoCultura);
  parCaracteristicaValorCultura.appendChild(caracteristicaCultura);

  // crear contenedor del valor del dato, agregar contenido y anexar al contenedor del dato cultura
  const valorCultura = document.createElement("div");
  valorCultura.classList.add("valor");
  const pValorDatoCultura = document.createElement("p");
  pValorDatoCultura.innerHTML = obra.culture;
  valorCultura.appendChild(pValorDatoCultura);
  parCaracteristicaValorCultura.appendChild(valorCultura);

  // anexar el contenedor del dato cultura al contenedor de datos de la obra
  contenedorCaracteristicas.appendChild(parCaracteristicaValorCultura);
}

// agregar dinastía a datos de la obra
function agregarDinastiaADatos(contenedorCaracteristicas, obra) {
  // crear contenedor del dato dinastía
  const parCaracteristicaValorDinastia = document.createElement("div");
  parCaracteristicaValorDinastia.classList.add("par-caracteristica-valor");

  // crear contenedor del tipo del dato, agregar contenido y anexar al contenedor del dato dinastía   
  const caracteristicaDinastia = document.createElement("div");
  caracteristicaDinastia.classList.add("caracteristica");
  const pTipoDatoDinastia = document.createElement("p");
  pTipoDatoDinastia.innerHTML = "Dinastía:";
  caracteristicaDinastia.appendChild(pTipoDatoDinastia);
  parCaracteristicaValorDinastia.appendChild(caracteristicaDinastia);

  // crear contenedor del valor del dato, agregar contenido y anexar al contenedor del dato dinastía
  const valorDinastia = document.createElement("div");
  valorDinastia.classList.add("valor");
  const pValorDatoValor = document.createElement("p");
  pValorDatoValor.innerHTML = obra.dynasty;
  valorDinastia.appendChild(pValorDatoValor);
  parCaracteristicaValorDinastia.appendChild(valorDinastia);

  // anexar el contenedor del dato dinastía al contenedor de datos de la obra
  contenedorCaracteristicas.appendChild(parCaracteristicaValorDinastia);
}

// crear y agregar datos de obra en carta
function agregarDatosACarta(carta, obra) {
  // crear contenedor de datos de la obra
  const caracteristicasObra = document.createElement("div");
  caracteristicasObra.classList.add("caracteristicas-obra");

  agregarTituloADatos(caracteristicasObra, obra);
  agregarCulturaADatos(caracteristicasObra, obra);
  agregarDinastiaADatos(caracteristicasObra, obra);

  // anexar contenedor de datos de la obra al contenedor de la "carta" 
  carta.appendChild(caracteristicasObra);
}

// agregar enlace a imagenes adicionales a obra si esta última las tiene
function agregarBotonImgAdicionales(carta, obra) {
  const arrImgAdicionales = obra.additionalImages || 0;
  if (arrImgAdicionales.length > 0) {
    // TAREA DEL SERVIDOR: crear nueva página cuando se clickee en el botón de img adicionales
    /* // crear componente
    const botonImgAdicionales = document.createElement("button");

    // configurar componente
    botonImgAdicionales.type = "button";
    botonImgAdicionales.classList.add("boton-img-adicionales");
    botonImgAdicionales.innerHTML = "Ver imagenes adicionales";
    botonImgAdicionales.addEventListener("click", mostrarImgAdicionales);
    // anexar componentes
    carta.appendChild(botonImgAdicionales); */

    // crear componente
    const enlaceImgAdicionales = document.createElement("a");

    // configurar componente
    enlaceImgAdicionales.classList.add("enlace-img-adicionales");
    enlaceImgAdicionales.innerHTML = "Ver imagenes adicionales";
    enlaceImgAdicionales.href = obra.URLImagenesAdicionales;
    enlaceImgAdicionales.target = "_blank";

    // anexar componente
    carta.appendChild(enlaceImgAdicionales);
  }
}

// ocultar elementos de formulario y colocar mensaje
function ocultarElementos() {
  FORMULARIO.style.display = 'none';

  // crear y colocar mensaje de búsqueda    
  const mensajeCargando = document.createElement("p");
  mensajeCargando.id = "mensaje-cargando-informacion";
  mensajeCargando.innerHTML = "Cargando información";

  // actualizar mensaje cada segundo
  const intervalo = setInterval(() => {
    if (mensajeCargando !== undefined) {
      // el mensaje permanece

      // cambiar mensaje
      if (mensajeCargando.innerHTML.slice(-3) !== '...') {
        mensajeCargando.innerHTML += '.';
      } else {
        mensajeCargando.innerHTML = "Cargando información";
      }
    } else {
      // se quitó el mensaje
      clearInterval(intervalo);
    }
  }, 1000);
  FORMULARIO.insertAdjacentElement("afterend", mensajeCargando);
}

BOTON_BUSCAR.addEventListener("click", () => {
  BOTON_BUSCAR.disabled = true;
  mostrarResultados();
});
BOTON_LIMPIAR.addEventListener("click", () => {
  PALABRA_CLAVE.value = '';
  LOCALIZACION.value = '';
  DEPARTAMENTOS.value = -1;
  quitarResultados();
})
PALABRA_CLAVE.addEventListener("input", quitarResultados);
LOCALIZACION.addEventListener("input", quitarResultados);
DEPARTAMENTOS.addEventListener("change", quitarResultados);

ocultarElementos();
colocarDepartamentos();
