import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from 'living-art-ui'

// value="features" opens the first menu so its panel renders in-card.
export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, minHeight: 280 }}>
      <NavigationMenu value="features">
        <NavigationMenuList>
          <NavigationMenuItem value="features">
            <NavigationMenuTrigger>Features</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul style={{ display: 'grid', gap: 10, padding: 16, width: 320 }}>
                <li>
                  <NavigationMenuLink href="#">
                    <div style={{ fontWeight: 600 }}>Curated gallery</div>
                    <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Hundreds of living artworks.</div>
                  </NavigationMenuLink>
                </li>
                <li>
                  <NavigationMenuLink href="#">
                    <div style={{ fontWeight: 600 }}>Daily additions</div>
                    <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Fresh pieces for subscribers.</div>
                  </NavigationMenuLink>
                </li>
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem value="pricing">
            <NavigationMenuLink href="#">Pricing</NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  )
}
