import MapWrapper from "./MapWrapper.jsx"

export default function Home() {
  return (
    <main style={{ padding: "2rem" }}>
      <h1>UrbanFlow Dashboard</h1>
      <p>Select points on the map to mark disruptions 🚦</p>
      <MapWrapper />
    </main>
  )
}
