import { NavBar } from "@/components/NavBar"
import { Hero } from "@/components/Hero"
import { Features } from "@/components/Features"
import { Screenshots } from "@/components/Screenshots"
import { Showcase } from "@/components/Showcase"
import { TechStack } from "@/components/TechStack"
import { Stats } from "@/components/Stats"
import { FAQ } from "@/components/FAQ"
import { Community } from "@/components/Community"
import { CTA } from "@/components/CTA"
import { Footer } from "@/components/Footer"

function App() {
  return (
    <>
      <NavBar />
      <Hero />
      <Features />
      <Screenshots />
      <Showcase />
      <TechStack />
      <Stats />
      <FAQ />
      <Community />
      <CTA />
      <Footer />
    </>
  )
}

export default App
