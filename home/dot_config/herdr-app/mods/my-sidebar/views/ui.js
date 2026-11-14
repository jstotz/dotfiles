// The design kit: Herdr's own conventions, measured from its shipped mods, as
// tokens and small components. UI only: values in, callbacks out, no Git or
// Herdr commands. Components return ordinary elements, so callers can chain.
import { div, svg } from "gpui-kit";
import { h_flex, v_flex, Popover } from "gpui-base";
import { theme } from "herdr";

// Plain px: Herdr scales a mod's sizes by zoom itself.
export const TEXT = {
  badge: 10,
  avatar: 10.5,
  caption: 11,
  label: 11.5,
  small: 12,
  menu: 12.8,
  body: 13,
};
const RADIUS = { small: 4, control: 6, row: 7 };
export const SIZE = { group: 30, menu: 31, row: 28, icon: 26, iconSmall: 20 };

export const Icon = (name, size = 14) =>
  svg(`mods/my-sidebar/icons/${name}.svg`).size(size).flex_none();

export function Badge(text) {
  const t = theme();
  return div()
    .flex_none()
    .px(5)
    .py(1)
    .rounded(RADIUS.small)
    .border_1()
    .border_color(t.border)
    .text_size(TEXT.badge)
    .text_color(t.muted)
    .child(String(text));
}

export function IconButton({ id, icon, label, onClick, iconSize = 15, muted = false }) {
  const t = theme();
  return div()
    .id(id)
    .size(SIZE.icon)
    .flex_none()
    .flex()
    .items_center()
    .justify_center()
    .rounded(RADIUS.control)
    .text_color(muted ? t.dim : t.foreground)
    .cursor_pointer()
    .accessibility_label(label)
    .tooltip(label)
    .hover((s) => s.bg(t.hover).text_color(t.foreground))
    .when(Boolean(onClick), (el) =>
      el.on_click((_e, cx) => {
        cx.stop_propagation();
        onClick(cx);
      }),
    )
    .child(Icon(icon, iconSize));
}

// A section heading in a list. Its chevron and click fold the section.
export function GroupHeader({
  id,
  label,
  count,
  labelColor,
  folded = false,
  divided = false,
  action,
  onClick,
}) {
  const t = theme();
  return h_flex()
    .id(id)
    .h(SIZE.group)
    .flex_none()
    .px(8)
    .gap(6)
    .items_center()
    .text_size(TEXT.caption)
    .text_color(t.muted)
    .cursor_pointer()
    .when(divided, (el) => el.mt(4).border_t(1).border_color(t.border))
    .hover((s) => s.text_color(t.foreground))
    .on_click((_e, cx) => onClick(cx))
    .child(
      div()
        .min_w(0)
        .truncate()
        .font_medium()
        .text_color(labelColor ?? t.muted)
        .child(label),
    )
    .child(Badge(count))
    .child(div().flex_1())
    .when(Boolean(action), (el) => el.child(action))
    .child(div().flex_none().p(2).child(Icon(folded ? "chevron-right" : "chevron-down", 11).text_color(t.dim)));
}

// One step of a tree's line, in front of a nested row: "│" carries on past it,
// "├" branches to it, "└" ends at it, "" leaves the column blank. `mid` is how far
// down the row its title sits, where the branch turns.
export function Rail(kind, mid = 15) {
  const t = theme();
  const line = () => div().absolute().left(17.5).top(0).border_color(t.input);
  return div()
    .relative()
    .w(24)
    .flex_none()
    .self_stretch()
    .when(kind === "│" || kind === "├", (el) => el.child(line().bottom(0).border_l(1.5)))
    .when(kind === "├" || kind === "└", (el) =>
      el.child(line().h(mid).w(7).border_l(1.5).border_b(1.5).rounded_bl(6)),
    );
}

// A popup anchored to its trigger.
export function Menu({ id, open, onOpenChange, focus, trigger, children, width = 220 }) {
  const t = theme();
  const body = v_flex()
    .id(`${id}-body`)
    .w(width)
    .p(5)
    .gap(1)
    .rounded(RADIUS.row)
    .border_1()
    .border_color(t.border)
    .bg(t.popover)
    .text_color(t.foreground)
    .track_focus(focus)
    .on_key_down((event, cx) => {
      if (event.key !== "escape") return;
      cx.stop_propagation();
      onOpenChange(false, cx);
    })
    .children(children);
  return Popover.new(id)
    .open(open)
    .anchor("top_right")
    .track_focus(focus)
    .on_open_change((value, cx) => onOpenChange(value, cx))
    .trigger(trigger)
    .when(open, (el) => el.content(body));
}

export function MenuLabel(text) {
  const t = theme();
  return div()
    .px(8)
    .pt(6)
    .pb(3)
    .text_size(TEXT.caption)
    .font_medium()
    .text_color(t.dim)
    .child(text);
}

export function MenuOption({ id, icon, label, selected, onClick }) {
  const t = theme();
  return h_flex()
    .id(id)
    .h(SIZE.menu)
    .flex_none()
    .px(8)
    .gap(9)
    .items_center()
    .rounded(RADIUS.row)
    .cursor_pointer()
    .text_size(TEXT.menu)
    .role("menu_item_radio")
    .aria_selected(Boolean(selected))
    .hover((s) => s.bg(t.hover))
    .on_click((_e, cx) => onClick(cx))
    .child(Icon(icon, 14).text_color(t.muted))
    .child(div().flex_1().child(label))
    .when(selected, (el) => el.child(Icon("check", 14)));
}
