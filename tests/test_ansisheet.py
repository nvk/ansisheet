import unittest

from tools.ansisheet import parse_ansi, render_svg


class AnsisheetTests(unittest.TestCase):
    def test_plain_text_dimensions(self):
        result = parse_ansi("AB\nC")

        self.assertEqual(result["cols"], 2)
        self.assertEqual(result["rows"], 2)
        self.assertEqual(result["frame"][1][0].ch, "C")

    def test_sgr_color(self):
        result = parse_ansi("\x1b[31mR\x1b[0mN", cols=4)

        self.assertEqual(result["frame"][0][0].fg, "#aa0000")
        self.assertIsNone(result["frame"][0][1].fg)

    def test_cursor_position(self):
        result = parse_ansi("A\x1b[2;3HB", cols=5, rows=3)

        self.assertEqual(result["frame"][0][0].ch, "A")
        self.assertEqual(result["frame"][1][2].ch, "B")

    def test_clear_screen_records_frames(self):
        result = parse_ansi("ONE\x1b[2JTWO", cols=8, rows=2)

        self.assertEqual(len(result["frames"]), 2)
        self.assertEqual(result["frames"][0][0][0].ch, "O")
        self.assertEqual(result["frames"][1][0][0].ch, "T")

    def test_svg_viewbox(self):
        result = parse_ansi("█")
        svg = render_svg(result["frame"])

        self.assertIn('viewBox="0 0 10 20"', svg)
        self.assertIn('preserveAspectRatio="xMidYMid meet"', svg)
        self.assertIn("<rect", svg)

    def test_box_drawing_uses_text_cell(self):
        result = parse_ansi("╔═╗")
        svg = render_svg(result["frame"])

        self.assertIn('shape-rendering="crispEdges"', svg)
        self.assertIn('<rect x="3.8"', svg)
        self.assertNotIn(">╔</text>", svg)


if __name__ == "__main__":
    unittest.main()
