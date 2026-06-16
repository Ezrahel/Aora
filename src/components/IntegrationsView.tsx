import { useState } from "react";
import { Layers, CheckCircle2, CloudLightning, ShieldAlert, Sparkles } from "lucide-react";

export default function IntegrationsView() {
  const [integrationsList, setIntegrationsList] = useState([
    { id: "stripe", name: "Stripe Gateway", desc: "Map credit card token structures and synchronize billing intents.", category: "Processor", connected: true, logo: "S" },
    { id: "lago", name: "Lago Aggregator", desc: "Sync high-volume event streams for hybrid overage operations.", category: "Usage Core", connected: true, logo: "L" },
    { id: "slack", name: "Slack Alerts", desc: "Trigger duning warnings and receipt messages to dedicated customer rooms.", category: "Slack Notification", connected: true, logo: "Sl" },
    { id: "salesforce", name: "Salesforce CRM", desc: "Import usage events automatically into active meters.", category: "Data Sync", connected: false, logo: "Sf" },
    { id: "hubspot", name: "HubSpot System", desc: "Synchronize company conversions directly to contract builders.", category: "Marketing CRM", connected: false, logo: "H" }
  ]);

  const handleToggleConnect = (id: string) => {
    setIntegrationsList(prev => 
      prev.map(item => 
        item.id === id ? { ...item, connected: !item.connected } : item
      )
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Intro Head banner */}
      <div className="border-b border-[#E5E5E7] pb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-[#111111]">Integrations Hub</h2>
        <p className="text-xs text-[#6E6E73] mt-1.5 font-medium">
          Drape external connectors effortlessly across operations. Stream webhook signals, sync leads, and bridge processor networks instantly.
        </p>
      </div>

      {/* Grid containing services tiles */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-[#6E6E73] uppercase tracking-wider text-left">Available Integrations</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrationsList.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-[#E5E5E7] p-5.5 rounded-2xl text-left space-y-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                
                {/* Header title */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-sm bg-neutral-900 border text-white`}>
                      {item.logo}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#111111]">{item.name}</h4>
                      <span className="text-[9px] bg-[#F5F5F7] text-[#6E6E73] font-semibold px-2 py-0.5 rounded-full uppercase">
                        {item.category}
                      </span>
                    </div>
                  </div>

                  <span className={`h-2 w-2 rounded-full ${item.connected ? "bg-[#34C759] animate-pulse" : "bg-neutral-300"}`} />
                </div>

                <p className="text-[11px] text-[#6E6E73] leading-relaxed font-medium">
                  {item.desc}
                </p>

              </div>

              {/* Toggle switch action footer */}
              <div className="flex justify-between items-center border-t border-[#F5F5F7] pt-4.5">
                <span className={`text-[10px] font-bold ${item.connected ? "text-[#34C759]" : "text-neutral-400"}`}>
                  {item.connected ? "Active Sync Node" : "Disconnected"}
                </span>
                
                <button
                  id={`integration-toggle-${item.id}`}
                  onClick={() => handleToggleConnect(item.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer border transition-all ${
                    item.connected
                      ? "bg-white text-rose-600 border-rose-100 hover:bg-rose-50"
                      : "bg-[#111111] text-white border-transparent hover:bg-neutral-800"
                  }`}
                >
                  {item.connected ? "Revoke Access" : "Connect Adapter"}
                </button>
              </div>

            </div>
          ))}
        </div>
      </div>

      {/* Synchronizing advice note */}
      <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl text-left text-xs flex gap-2.5 items-start md:max-w-2xl font-medium">
        <CheckCircle2 className="h-5 w-5 text-stone-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-[#111111]">Lago Event Stream Syncer Active</p>
          <p className="text-[#6E6E73] text-[11px] leading-relaxed">
            Lago webhook trigger maps incoming vectors directly down to `compute_meter` definitions. Raw client JSON messages translate directly into ledger overage costs with zero delay.
          </p>
        </div>
      </div>

    </div>
  );
}
