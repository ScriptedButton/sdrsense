import { SdrApp } from "@/components/sdr/sdr-app";
import { SdrProvider } from "@/components/sdr/sdr-provider";

export default function Home() {
  return (
    <SdrProvider>
      <SdrApp />
    </SdrProvider>
  );
}
