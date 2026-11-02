import { useCallback, useEffect, useState } from 'react'
import { BackstagePanel } from './components/BackstagePanel'
import { Cart } from './components/Cart'
import { Checkout } from './components/Checkout'
import { KitchenDisplay } from './components/KitchenDisplay'
import { Menu } from './components/Menu'
import { OrderTracker } from './components/OrderTracker'
import { SettingsModal } from './components/SettingsModal'
import { TemporalCodeView } from './components/TemporalCodeView'
import { TraditionalArchDiagram } from './components/TraditionalArchDiagram'
import { pathLabel } from './data/scenarios'
import { useSSE } from './hooks/useSSE'
import { PaneCollapseButton, PaneLayout } from './kit/react/PaneLayout'
import { PhoneFrame } from './kit/react/PhoneFrame'
import temporalLogo from './kit/brand/temporal-logo.svg'
import type {
  CartItem,
  CreateOrderResponse,
  DemoTab,
  MenuItem,
  PhoneScreen,
  Settings,
  TemporalUiInfo,
} from './types'

const DEFAULT_SETTINGS: Settings = {
  mode: 'temporal',
  failure_scenario: 'store_connectivity',
  presentation_mode: 'detailed',
  worker_language: 'python',
}

function App() {
  const [tab, setTab] = useState<DemoTab>('customer')
  const [screen, setScreen] = useState<PhoneScreen>('menu')
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderId, setOrderId] = useState<string | null>(null)
  const [isOrdering, setIsOrdering] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [temporalUi, setTemporalUi] = useState<TemporalUiInfo | null>(null)
  const [temporalWorkflowUrl, setTemporalWorkflowUrl] = useState<string | null>(null)
  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const { events, finalStatus, reset: resetSSE } = useSSE(orderId)

  // Load settings from backend on mount
  useEffect(() => {
    // Load backend settings + detected worker language
    Promise.all([
      fetch('/api/settings').then((r) => r.json()),
      fetch('/api/worker-language').then((r) => r.json()).catch(() => ({ language: 'python' })),
      fetch('/api/temporal-ui').then((r) => r.json()).catch(() => null),
    ]).then(([backendSettings, langData, temporalUiData]) => {
      setSettings((prev) => ({
        ...prev,
        ...backendSettings,
        worker_language: langData.language || 'python',
      }))
      if (temporalUiData?.namespace_url) {
        setTemporalUi(temporalUiData)
      }
    }).catch(() => {})
  }, [])

  const handleSaveSettings = useCallback(
    async (newSettings: Settings) => {
      setSettings(newSettings)
      // Send only backend-relevant settings (worker_language is frontend-only)
      const { worker_language: _, ...backendSettings } = newSettings
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendSettings),
      })
      // Reset order state when settings change
      setOrderId(null)
      setTemporalWorkflowUrl(null)
      setWorkflowId(null)
      setScreen('menu')
      setCart([])
      resetSSE()
    },
    [resetSSE]
  )

  const handleAddToCart = useCallback((item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menu_item_id === item.id)
      if (existing) {
        return prev.map((c) =>
          c.menu_item_id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        )
      }
      return [
        ...prev,
        { menu_item_id: item.id, name: item.name, quantity: 1, price: item.price },
      ]
    })
  }, [])

  const handleUpdateQuantity = useCallback(
    (menuItemId: string, delta: number) => {
      setCart((prev) =>
        prev
          .map((c) =>
            c.menu_item_id === menuItemId
              ? { ...c, quantity: c.quantity + delta }
              : c
          )
          .filter((c) => c.quantity > 0)
      )
    },
    []
  )

  const handlePlaceOrder = useCallback(async () => {
    setIsOrdering(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart }),
      })
      const data = (await res.json()) as CreateOrderResponse
      setOrderId(data.order_id)
      setTemporalWorkflowUrl(data.temporal_ui_url || null)
      setWorkflowId(data.workflow_id || null)
      setScreen('tracking')
    } finally {
      setIsOrdering(false)
    }
  }, [cart])

  const handleNewOrder = useCallback(() => {
    setOrderId(null)
    setTemporalWorkflowUrl(null)
    setWorkflowId(null)
    setCart([])
    setScreen('menu')
    resetSSE()
  }, [resetSSE])

  const renderPhoneContent = () => {
    switch (screen) {
      case 'menu':
        return (
          <Menu
            cart={cart}
            onAddToCart={handleAddToCart}
            onViewCart={() => setScreen('cart')}
          />
        )
      case 'cart':
        return (
          <Cart
            items={cart}
            onUpdateQuantity={handleUpdateQuantity}
            onCheckout={() => setScreen('checkout')}
            onBack={() => setScreen('menu')}
          />
        )
      case 'checkout':
        return (
          <Checkout
            items={cart}
            onPlaceOrder={handlePlaceOrder}
            onBack={() => setScreen('cart')}
            isLoading={isOrdering}
          />
        )
      case 'tracking':
        return (
          <OrderTracker
            events={events}
            finalStatus={finalStatus}
            settings={settings}
            onNewOrder={handleNewOrder}
          />
        )
    }
  }

  const isTemporal = settings.mode === 'temporal'

  return (
    <div className="app-shell two-row">
      <header className="topbar">
        <div className="brand">
          <img src={temporalLogo} alt="Temporal" width="172" height="44" />
          <span className="brand-divider" />
          <p className="eyebrow">Déjà Vu Tacos · order Workflow</p>
        </div>

        <div className="segmented" role="group" aria-label="View">
          <button type="button" aria-current={tab === 'customer' ? 'page' : undefined} onClick={() => setTab('customer')}>
            Customer app
          </button>
          <button type="button" aria-current={tab === 'kitchen' ? 'page' : undefined} onClick={() => setTab('kitchen')}>
            Kitchen display
          </button>
        </div>

        <div className="topbar-actions">
          {/* The path the demo is on, where the room can see it. It opens the settings. */}
          <button
            type="button"
            className="button secondary ultraviolet small"
            onClick={() => setSettingsOpen(true)}
            aria-haspopup="dialog"
            title="Change the path: architecture, failure scenario, presentation"
          >
            {pathLabel(settings)}
          </button>
          {/* Inert rather than absent until the server supplies the URL. */}
          <a
            className="button secondary green small"
            href={temporalUi?.namespace_url || undefined}
            target={temporalUi?.namespace_url ? '_blank' : undefined}
            rel="noreferrer"
            aria-disabled={temporalUi?.namespace_url ? undefined : true}
            title={
              temporalUi?.namespace
                ? `Open ${temporalUi.namespace} in the Temporal UI`
                : 'Available once the server reports the Temporal UI address'
            }
          >
            Temporal UI
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>
          </a>
        </div>
      </header>

      <main className="min-h-0 min-w-0">
        {/* The customer view stays mounted so the pane arrangement survives a tab switch. */}
        <div className="h-full" hidden={tab !== 'customer'}>
          <PaneLayout
            storageKey="dejavu-tacos:panes"
            panes={[
              {
                id: 'phone',
                title: 'Customer app',
                defaultWidth: 400,
                minWidth: 260,
                content: (
                  <div className="pane-stack">
                    <div className="card-head pr-2">
                      <div>
                        <p className="eyebrow">The product</p>
                        <h2 className="heading">Customer app</h2>
                      </div>
                      <PaneCollapseButton />
                    </div>
                    {/* The restaurant's own app: its colours, not Temporal's. */}
                    <PhoneFrame
                      chrome="linear-gradient(to right, #f97316, #ef4444)"
                      background="#fff7ed"
                      foreground="#1f2937"
                    >
                      {renderPhoneContent()}
                    </PhoneFrame>
                  </div>
                ),
              },
              {
                id: 'backstage',
                title: 'Behind the scenes',
                defaultWidth: 420,
                minWidth: 280,
                content: (
                  <BackstagePanel
                    events={events}
                    settings={settings}
                    finalStatus={finalStatus}
                    workflowId={workflowId}
                    temporalWorkflowUrl={temporalWorkflowUrl}
                  />
                ),
              },
              {
                id: 'proof',
                title: isTemporal ? 'Workflow code' : 'Architecture',
                minWidth: 320,
                content: isTemporal ? (
                  <TemporalCodeView
                    events={events}
                    finalStatus={finalStatus}
                    language={settings.worker_language}
                    // Display only: switching tabs mid-order keeps the order running.
                    onLanguageChange={(worker_language) => setSettings((s) => ({ ...s, worker_language }))}
                  />
                ) : (
                  <TraditionalArchDiagram events={events} finalStatus={finalStatus} />
                ),
              },
            ]}
          />
        </div>
        {/* The kitchen is the restaurant's own screen, so it keeps its own look. It polls,
            so it is only mounted while it is showing. */}
        {tab === 'kitchen' && (
          <div className="restaurant-app h-full flex">
            <KitchenDisplay />
          </div>
        )}
      </main>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />
    </div>
  )
}

export default App
