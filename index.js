import { F1TelemetryClient, constants } from "@deltazeroproduction/f1-udp-parser";
import fs from "fs";
import { readFile } from 'fs/promises';

const { PACKETS } = constants;

/*
---------------------------------
ESTADO GLOBAL
---------------------------------
*/

const drivers = new Map();

const raceData = {
  started: false,
  finished: false,
  trackId: null,
  totalLaps: 0,
  fastestLap: null,
  results: []
};

/*
---------------------------------
UDP CLIENT
---------------------------------
*/

const client = new F1TelemetryClient({ port: 20777 });

client.on("connect", () => {
  console.log("✅ Telemetría conectada");
});

client.on(PACKETS.participants, onParticipants);
client.on(PACKETS.session, onSession);
client.on(PACKETS.lapData, onLapData);
client.on(PACKETS.finalClassification, onFinalClassification);

client.start();

console.log("🚀 Esperando datos del juego...");

fakearResultados()



/*
---------------------------------
PARTICIPANTS
---------------------------------
*/

function onParticipants(data) {

  drivers.clear();

  data.m_participants.forEach((p, index) => {

    if (!p.m_name) return;

    drivers.set(index, {
      name: p.m_name.trim(),
      teamId: p.m_teamId,
      raceNumber: p.m_raceNumber
    });

  });

  console.log(`👨‍🏎️ Pilotos detectados: ${drivers.size}`);
}


/*
---------------------------------
SESSION INFO
---------------------------------
*/

function onSession(data) {

  raceData.trackId = data.m_trackId;
  raceData.totalLaps = data.m_totalLaps;

}


/*
---------------------------------
LIVE DATA
---------------------------------
*/

function onLapData(data) {

  data.m_lapData.forEach((lap, index) => {

    const driver = drivers.get(index);
    if (!driver) return;

    // detectar inicio de carrera
    //TODO: cambiar al tiempo de carrera != 0??
    if (!raceData.started && lap.m_currentLapNum > 1) {
      raceData.started = true;
      console.log("🏁 Carrera iniciada");
    }

  });

}


/*
---------------------------------
FINAL RESULTS
---------------------------------
*/

function onFinalClassification(data) {

  if (raceData.finished) return;
  if(drivers.size == 0){
    console.log("Error en datos, faltan pilotos");
    return;
  }

  raceData.finished = true;

  console.log("🏁 Carrera finalizada");

  let fastestLap = Infinity;
  let fastestDriver = null;

  const results = [];

  const cars = data.m_classificationData.slice(0, data.m_numCars);

  cars.forEach((car, index) => {

    const driver = drivers.get(index);

    if (!driver) return;

    if (
      car.m_bestLapTimeInMS > 0 &&
      car.m_bestLapTimeInMS < fastestLap
    ) {
      fastestLap = car.m_bestLapTimeInMS;
      fastestDriver = driver.name;
    }

    results.push({

      position: car.m_position,
      name: driver.name,
      teamId: driver.teamId,
      raceNumber: driver.raceNumber,

      grid: car.m_gridPosition,
      laps: car.m_numLaps,
      pits: car.m_numPitStops,

      points: car.m_points,

      bestLap: car.m_bestLapTimeInMS,
      totalTime: car.m_totalRaceTime,

      //TODO: arreglar vuelta rapida
      fastestLapPoint: fastestDriver == driver.name && car.m_position <= 10

    });

  });

  raceData.results = results;

  raceData.fastestLap = {
    driver: fastestDriver,
    time: fastestLap
  };

  printResults();
  saveResults();
}


/*
---------------------------------
PRINT RESULTADOS
---------------------------------
*/

function printResults() {

  console.log("");
  console.log("🏆 RESULTADOS");

   raceData.results
    .sort((a,b)=>a.position-b.position)
    .forEach(r => {

      const bestLap = r.bestLap
        ? (r.bestLap/1000).toFixed(3)
        : "N/A";

      console.log(
        `P${r.position} | ${r.name} | Laps:${r.laps} | Best:${bestLap},points:${r.points}, fastestLapPoint:${r.fastestLapPoint}`
      );

    });

  console.log("");

  if (raceData.fastestLap) {

    console.log(
      `⚡ Vuelta rápida: ${raceData.fastestLap.driver} ${
        (raceData.fastestLap.time/1000).toFixed(3)
      }`
    );

  }

}


/*
---------------------------------
SAVE JSON
---------------------------------
*/

function saveResults() {

  fs.writeFileSync(
    "./raceResult.json",
    JSON.stringify( raceData.results, null, 2)
  );

  console.log("💾 Resultados guardados en raceResult.json");

}

async function fakearResultados() {
    raceData.results = JSON.parse(await readFile('./raceResult.json', 'utf8'));
    while(true){
      //printResults();



      fetch(" http://192.168.56.1:3000/api?consulta=datosCarrera", {
        method: "POST",
        body: JSON.stringify(raceData.results),
        headers: { "Content-type": "application/json; charset=UTF-8" }
      }).then((response) => {
        console.log(response.status);
        //TODO esto esta roto jejeje
        if(response.status != 200){
          console.log("error?");
          throw new Error();
        }
      })





      await sleep(3000);
    }
    
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


