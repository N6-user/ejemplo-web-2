const express = require('express'),
  cors = require('cors'),
  translate = require('node-google-translate-skidz'),
  app = express(),
  PORT = process.env.PORT || 3000,
  arrObrasImgAdicionales = [];

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/public/html/index.html');
});

app.get('/obtenerDepartamentos', async function (req, res) {
  try {
    // obtener departamentos desde la API
    const response = await fetch('https://collectionapi.metmuseum.org/public/collection/v1/departments');
    const datos = await response.json();
    const departamentos = datos.departments;

    // traducirlos
    const traducciones = [];
    for (const depto of departamentos) {
      // realizar traducciones asíncronamente
      traducciones.push(translate({
        text: depto.displayName,
        source: 'en',
        target: 'es'
      }, function (result) {
        depto.displayName = result.translation;
      }));

      try {
        await Promise.all(traducciones);
      } catch (error) {
        console.log(`Error: ${error}`);
      }
    }

    res.status(200).json(departamentos);
  } catch (error) {
    console.log('Error: ' + error);
    res.send(error);
  }
});

app.post('/obtenerIDs', async function (req, res) {
  // obtener palabras de la request
  let palabraClave = req.body.palabraClave,
    localizacion = req.body.localizacion,
    departamento = req.body.departamento;

  // traducir al inglés la palabra clave y la localización (departamento es un id). Dado que la traducción es asíncrona es necesario usar await para evitar que se prosiga sin haber traducido los filtros  
  if (palabraClave !== '') {
    try {
      await translate({
        text: palabraClave,
        source: 'es',
        target: 'en'
      }, function (result) {
        palabraClave = result.translation;
      });
    } catch (error) {
      console.log(`Error: ${error}`);
      res.send(error);
    }
  }

  if (localizacion !== '') {
    try {
      await translate({
        text: localizacion,
        source: 'es',
        target: 'en'
      }, function (result) {
        localizacion = result.translation;
      });
    } catch (error) {
      console.log(`Error: ${error}`);
      res.send(error);
    }
  }

  // crear URL con consulta
  let consulta = "https://collectionapi.metmuseum.org/public/collection/v1/search?";

  if (departamento != -1) {
    // se eligió departamento

    consulta += `departmentId=${departamento}&`;
  }
  if (localizacion != "") {
    // se ingresó una localización

    consulta += `geoLocation=${localizacion.replace(/ /g, "%20")}&`;
  }

  if (palabraClave != "") {
    // se ingresó una palabra clave

    consulta += `q=${palabraClave}&`;
  } else {
    // no se ingresó una palabra clave

    consulta += `q=""&`;
  }


  // este parámetro se coloca al final por que (aparentemente) la API no lo toma en cuenta de otro modo
  consulta += `hasImages=true`;

  // obtener id's de obras de la API  
  fetch(consulta)
    .then(response => response.json())
    .then(datos => res.status(200).json(datos))
    .catch(error => {
      console.log('Error: ' + error);
      res.send(error);
    })
});

app.post('/obtenerObras', async function (req, res) {
  const listaIDs = req.body.ids,
    promesas = [];
  arrObrasImgAdicionales.length = 0;

  // preparar tareas asíncronas para la obtención de una obra
  async function obtenerObra(id) {
    // buscar obra en la API
    const response = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
    const obra = await response.json();

    // si la obra no está registrada en la API, descartar
    if (obra.message !== undefined) {
      return null;
    }

    // si la obra no tiene imagen, descartar
    if (obra.primaryImage === '') {
      return null;
    }

    // permitir ver imágenes adicionales, en caso de que las tenga
    if (obra.additionalImages.length > 0) {
      // la obra tiene imágenes adicionales

      // adjuntar URL a endpoint de imágenes adicionales a la obra para luego poder mostrar sus imágenes adicionales
      obra.URLImagenesAdicionales = `http://localhost:3000/mostrarImagenesAdicionales/${obra.objectID}`

      // crear y guardar objeto con datos de la obra
      const obj = {
        id: obra.objectID,
        imgAdicionales: obra.additionalImages
      };

      arrObrasImgAdicionales.push(obj);
    }

    // traducir al español datos a mostrar de la obra
    const arrTraducciones = [];

    // título
    arrTraducciones.push(translate({
      text: obra.title,
      source: 'en',
      target: 'es'
    }, function (result) {
      obra.title = result.translation;
    }));

    // cultura
    if (obra.culture !== '') {
      arrTraducciones.push(translate({
        text: obra.culture,
        source: 'en',
        target: 'es'
      }, function (result) {
        obra.culture = result.translation;
      }));
    } else {
      obra.culture = 'no especificada';
    }

    // dinastía
    if (obra.dynasty !== '') {
      arrTraducciones.push(translate({
        text: obra.dynasty,
        source: 'en',
        target: 'es'
      }, function (result) {
        obra.dynasty = result.translation;
      }));
    } else {
      obra.dynasty = 'sin dinastía';
    }

    // fecha de origen
    if (obra.objectDate !== '') {
      arrTraducciones.push(translate({
        text: obra.objectDate,
        source: 'en',
        target: 'es'
      }, function (result) {
        obra.objectDate = result.translation;
      }));
    } else {
      obra.objectDate = 'no especificada';
    }

    await Promise.all(arrTraducciones)

    return obra
  }

  // realizar la obtención de las obras de forma asíncrona   
  for (const id of listaIDs) {
    promesas.push(obtenerObra(id));

    // esta espacio de tiempo tiene como objetivo evitar que el servidor rechace la solicitud de obras (desconozco excactamente el por qué de dicha relación, pero sé que existe)
    await new Promise((res, rej) => {
      setTimeout(() => {
        res(0);
      }, 20);
    });
  }

  const arrObras = [...(await Promise.all(promesas))];

  res.status(200).json(arrObras.filter(obra => obra !== null));
});

app.get('/mostrarImagenesAdicionales/:id', function (req, res) {
  const idBuscado = Number(req.params.id);
  const obra = arrObrasImgAdicionales.find(obra => obra.id === idBuscado);
  let imgs = obra.imgAdicionales;
  let imgsHTML = '';

  for (const img of imgs) {
    imgsHTML += `<img src="${img}" alt="imagen adicional de obra sin título especificado" style="margin:20px;display:inline-block;height:30%;width:40%;"></img>`;
  }

  res.send(`
  <!DOCTYPE html>
  <html lang="es">

  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
  </head>

  <body>
    ${imgsHTML}
  </body>

  </html>`);
});

app.all('*', function (req, res, next) {
  res.status(404).send('La página que busca no existe');
});

app.listen(PORT, function () {
  console.log(`Servidor en puerto ${PORT}`);
});



