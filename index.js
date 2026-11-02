/**
 * Host half of the sidebar-finder bundle.
 *
 * The Client module owns all rendering. This half exists so the bundle has a
 * Host entry point (the loader applies it) and so the configuration shape has
 * a single declared home. It deliberately registers no services: everything
 * the plugin needs (slots, layout, locale) is Client-side.
 */
export function apply() {}
