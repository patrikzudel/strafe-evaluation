import { createSignal, onMount, createEffect, onCleanup, For } from "solid-js";
import "./App.css";
import { Chart, registerables } from 'chart.js'
import { Bar } from 'solid-chartjs'
import { listen } from '@tauri-apps/api/event'

function draw_time(time) {
  return (time / 1000).toFixed(0) + " ms"
}

function getMeanAndVar(arr) {

  var sum = arr.reduce(function (pre, cur) {
    return pre + cur;
  })
  let num = arr.length
  var average = sum / num;

  let variance = 0;
  arr.forEach(num => {
    variance += ((num - average) * (num - average));
  });
  variance /= num;
  variance = Math.sqrt(variance)

  var res = {
    average: average,
    std_deviation: variance
  }

  return res
}

function getStats(duration_array) {
  if (duration_array.length < 1) {
    return { median: 0, min: 0, max: 0, average: 0, std_deviation: 0, samples: 0 }
  }
  const sorted = Array.from(duration_array).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  let median;
  if (sorted.length % 2 === 0) {
    median = (sorted[middle - 1] + sorted[middle]) / 2;
  }
  else median = sorted[middle]

  let o = getMeanAndVar(duration_array)
  return { median: median, min: sorted[0], max: sorted[sorted.length - 1], average: o.average, std_deviation: o.std_deviation, samples: duration_array.length }
}

function getOccurance(duration_array) {
  if (!duration_array || duration_array.length == 0) {
    console.log("Array too small for graph")
    return [0]
  }
  let out = new Array(41).fill(0);

  duration_array.map((x) => {
    let n = Math.ceil(x / 5000)
    out[n] = out[n] + 1
  })

  return out
}

const MyChart = (props) => {
  const labels = Array.from({ length: 201 / 5 + 1 }, (_, i) => i * 5);
  const [chartData, setChartData] = createSignal({
    labels: labels,
    datasets: [
      {
        label: 'Early',
        data: getOccurance([]),
        backgroundColor: "#a5c5ae",
      },
      {
        label: 'Late',
        data: [0],
        borderRadius: 5,
        backgroundColor: "#8cb5a8",
      },
    ],
  })


  onMount(() => {
    Chart.register(...registerables)
  })

  createEffect(() => {
    const { earlyStrafes, lateStrafes, perfectStrafes } = props;
    setChartData({
      labels: labels,
      datasets: [
        {
          label: 'Early',
          data: getOccurance(earlyStrafes),
          borderRadius: 5,
          backgroundColor: "#a5c5ae",
        },
        {
          label: 'Late',
          data: getOccurance(lateStrafes),
          borderRadius: 5,
          backgroundColor: "#8cb5a8",
        },
        {
          label: 'Perfect',
          data: [perfectStrafes.length],
          borderRadius: 5,
          backgroundColor: "#b5ac8c",
        },
      ],
    })
  })

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      x: {
        stacked: true,
      },
      y: {
        stacked: true
      }
    }
  }

  return (
    <div>
      <Bar data={chartData()} options={chartOptions} width={4} height={3} />
    </div>
  )
}


function Stats(props) {
  const [stats, setStats] = createSignal({ alls: getStats([]), early: getStats([]), late: getStats([]) }, { equals: false });
  const [perfectCount, setPerfectCount] = createSignal(0)


  createEffect(() => {
    const { earlyStrafes, lateStrafes, perfectStrafes } = props;

    setPerfectCount(perfectStrafes.length)
    setStats((prev) => {
      prev.alls = getStats([...earlyStrafes, ...lateStrafes, ...perfectStrafes])
      prev.early = getStats(earlyStrafes)
      prev.late = getStats(lateStrafes)
      return prev
    })
  })




  return (
    <div className="flex flex-col justify-center items-center flex-grow">
      <table style="width:100%">
        <tbody className=" text-center">
          <tr>
            <th></th>
            <th className="w-16">All</th>
            <th className="w-16">Early</th>
            <th className="w-16">Late</th>
          </tr>
          <tr>
            <th>Median</th>
            <td>{draw_time(stats().alls.median)}</td>
            <td>{draw_time(stats().early.median)}</td>
            <td>{draw_time(stats().late.median)}</td>
          </tr>
          <tr>
            <th>Average</th>
            <td>{draw_time(stats().alls.average)}</td>
            <td>{draw_time(stats().early.average)}</td>
            <td>{draw_time(stats().late.average)}</td>
          </tr>
          <tr>
            <th>Min</th>
            <td>{draw_time(stats().alls.min)}</td>
            <td>{draw_time(stats().early.min)}</td>
            <td>{draw_time(stats().late.min)}</td>
          </tr>
          <tr>
            <th>Max</th>
            <td>{draw_time(stats().alls.max)}</td>
            <td>{draw_time(stats().early.max)}</td>
            <td>{draw_time(stats().late.max)}</td>
          </tr>
          <tr>
            <th>Std. Deviation</th>
            <td>{draw_time(stats().alls.std_deviation)}</td>
            <td>{draw_time(stats().early.std_deviation)}</td>
            <td>{draw_time(stats().late.std_deviation)}</td>
          </tr>
          <tr>
            <th>Samples</th>
            <td>{(stats().alls.samples)}</td>
            <td>{(stats().early.samples)}</td>
            <td>{(stats().late.samples)}</td>
          </tr>
        </tbody>
      </table>
      <div className=" italic font-bold text-xl pt-4">
        <h1>Perfect {perfectCount() + "x"}</h1>
      </div>
    </div>
  )
}

function WASD() {
  const [aPressed, setAPressed] = createSignal(false);
  const [dPressed, setDPressed] = createSignal(false);

  createEffect(() => {
    let unlistenA
    let unlistenReleaseA
    let unlistenReleaseD
    let unlistenD
    const setupListeners = async () => {
      unlistenA = await listen('a-pressed', (event) => {
        setAPressed(true);
      });

      unlistenD = await listen('d-pressed', (event) => {
        setDPressed(true);
      });

      unlistenReleaseA = await listen('a-released', (event) => {
        setAPressed(false);
      });

      unlistenReleaseD = await listen('d-released', (event) => {
        setDPressed(false);
      });

    };

    onCleanup(() => {
      if (typeof unlistenA === "function") {
        console.log("Cleaned up key listeners")
        unlistenA();
        unlistenReleaseA();
        unlistenReleaseD();
        unlistenD();
      }
    });
    setupListeners();
  });

  async function simulateEarly() {
    setAPressed(true)
    setTimeout(() => {
      setAPressed(false)
    }, 500);
    setTimeout(() => {
      setDPressed(true)
    }, 850);
    setTimeout(() => {
      setDPressed(false)
    }, 1350);
  }

  async function simulateLate() {
    setAPressed(true)
    setTimeout(() => {
      setDPressed(true)
    }, 500);
    setTimeout(() => {
      setAPressed(false)
    }, 850);
    setTimeout(() => {
      setDPressed(false)
    }, 1350);
  }

  async function simulatePerfect() {
    setAPressed(true)
    setTimeout(() => {
      setDPressed(true)
    }, 500);
    setTimeout(() => {
      setAPressed(false)
    }, 500);
    setTimeout(() => {
      setDPressed(false)
    }, 1000);
  }

  return (
    <div className="flex group justify-center items-center w-full h-full   ">

      <div className="flex flex-col basis-0 flex-grow items-end opacity-0 -translate-x-2 duration-200 group-hover:opacity-100 group-hover:translate-x-0">
        <button className="wasd-button text-white bg-secondary" onClick={simulateEarly}>Early</button>
        <button className="wasd-button text-white bg-accent" onClick={simulateLate}>Late</button>
        <button className="wasd-button text-white bg-[#b5ac8c]" onClick={simulatePerfect}>Perfect</button>
      </div>

      <div className="flex justify-center basis-0 flex-grow">
        <div className="select-none pointer-events-none text-dark flex justify-between w-40 text-center font-bold text-xl">
          <div className={"flex  border-dark/10 border-r  border-b shadow-lg border-b-dark/50 w-16 h-16 rounded-md justify-center items-center duration-75" + (aPressed() ? " bg-accent/50 scale-100 translate-y-[4px]" : "bg-zinc-200/25 ")}>
            <p>
              A
            </p>
          </div>
          <div className={"flex  border-dark/10 border-l  border-b shadow-lg border-b-dark/50 w-16 h-16 rounded-md justify-center items-center duration-75" + (dPressed() ? " bg-accent/50 translate-y-[4px]" : "bg-zinc-200/25")}>
            <p>
              D
            </p>
          </div>
        </div>
      </div>
      <div className="basis-0 flex-grow bg-red-200 min-w-[200px] ">

      </div>


    </div>
  )
}

function App() {
  const [totalStrafes, setTotalStrafes] = createSignal([]);
  const [earlyStrafes, setEarlyStrafes] = createSignal([]);
  const [lateStrafes, setLateStrafes] = createSignal([]);
  const [perfectStrafes, setPerfectStrafes] = createSignal([]);

  function resetStrafes() {
    setEarlyStrafes([]);
    setLateStrafes([]);
    setPerfectStrafes([]);
    setTotalStrafes([]);
  }

  createEffect(() => {
    let unlistenStrafe
    const setupListeners = async () => {
      unlistenStrafe = await listen('strafe', (event) => {

        let strafe = { type: event.payload.strafe_type, duration: event.payload.duration }
        switch (strafe.type) {
          case "Early":
            setEarlyStrafes(a => [strafe.duration, ...a])
            break;
          case "Late":
            setLateStrafes(a => [strafe.duration, ...a])
            break;
          case "Perfect":
            setPerfectStrafes(a => [strafe.duration, ...a])
            break;
        }
        setTotalStrafes(a => [strafe, ...a])
      })
    };


    onCleanup(() => {
      if (typeof unlistenStrafe === "function") {
        unlistenStrafe();
      }
    });
    setupListeners();
  });
  return (
    <div class="w-screen h-screen bg-bright text-dark flex flex-col">
      {/* 1 */}
      <div className="flex justify-center items-center select-none pointer-events-none">

        <h1 className="mr-3 drop-shadow-lg  py-4 text-4xl pointer-events-none font-bold text-center text-bright text-stroke italic">PatrikZero's</h1>
        <h1 className="  py-4 text-4xl font-bold text-center pointer-events-none ">Strafe Evaluation</h1>
      </div>

      {/* 2 */}
      <div className=" justify-between flex-grow flex">
        {/* A */}
        <div className="flex flex-col rounded-xl border-t border-white m-4 p-4 w-[50%] bg-secondary/50 shadow-xl">
          <div className="flex justify-between mb-2">
            <h2 className="select-none text-2xl font-bold">Statistics</h2>
            <button className="text-bright select-none shadow-md px-2 rounded-md bg-primary hover:scale-110 " type="submit" onClick={() => {
              resetStrafes()
            }}>Reset</button>
          </div>
          <Stats earlyStrafes={earlyStrafes()} lateStrafes={lateStrafes()} perfectStrafes={perfectStrafes()}></Stats>
        </div>
        {/* B */}
        <div className="flex  flex-col m-4 justify-center rounded-xl w-[50%] ">
          <MyChart earlyStrafes={earlyStrafes()} lateStrafes={lateStrafes()} perfectStrafes={perfectStrafes()} ></MyChart>
        </div>
      </div>

      {/* 3 */}
      <div className="h-32 mb-4 flex items-center justify-center">
        <WASD></WASD>
      </div>
      {/* 4 */}
      <div className="flex  flex-row p-2 bg-accent/25 h-20 overflow-clip  w-full">

        <For each={totalStrafes()}>{(strafe, i) =>
          <div className="flex shadow-md select-none flex-col border-bright/75 border-t bg-secondary/45 rounded-md  justify-center items-center  min-w-16 mr-2 ">
            <p className="font-bold text-center">{strafe.type}</p>
            <p className="text-center">{draw_time(strafe.duration)}</p>
          </div>
        }</For>
      </div>
    </div >
  );
}

export default App;
