/**
 * The mark that goes at the end of every message, as bytes.
 *
 * WHY IT IS A CONSTANT AND NOT A FILE. The worker is compiled by `tsc`, which
 * emits JavaScript and nothing else. A PNG sitting beside the source would
 * need a copy step in the build, that step does not exist today, and the way a
 * missing copy step shows up is a broken image in a suspension notice on the
 * one day somebody is reading it carefully. Three kilobytes of constant cannot
 * go missing in production.
 *
 * WHY THERE IS AN IMAGE IN THE MAIL AT ALL, given that there deliberately was
 * not one until now. The objection was never images, it was REMOTE images: a
 * mail that fetches something from a server is a read receipt whether or not
 * anybody meant it as one, and it reports the time, the address and roughly
 * the place the message was opened. This is attached to the message and
 * referenced by `cid:`, so it is already in the recipient's client before
 * they open it and opening it asks nobody for anything. The property the tests
 * enforce has been sharpened accordingly, from "no image" to "nothing remote",
 * which is the property that was actually wanted.
 *
 * It is 96 pixels square and displayed at 40, so it stays sharp on a screen
 * that doubles it, and it carries its own background because a mark in
 * `#1B4A8F` on transparency vanishes in a client in dark mode.
 *
 * Regenerate it from `brand/mail-logo.svg`; `brand/README.md` has the command.
 */

/** Referenced from the HTML part as `cid:` this, and nowhere else. */
export const LOGO_CID = "studens-mark";

export const LOGO_TYPE = "image/png";

/** The file name a client shows if it lists attachments. */
export const LOGO_NAME = "studens.png";

export const LOGO_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAABmJLR0QA/wD/AP+gvaeTAAAI2UlEQVR4nO2df2yTxxnHv8/ZsZM4P0hCCIkNoQWStFu7pkGDVTQLXbsulK1QiTKNSmNiW1UR2oz1r1WdXLF201Ro1xEk2omuCKR1VOJ3KGgghCjbaAgjaykEKOSHHZIQx9RxEjt+39sfWYIdB+yE13dvef35y+/53nse3fd9732fu3vvCJNh+d9N9gHXt6HwRSCqIPAyDioEkAEgZVJlfn0YAtDHCW7iuADOTwP8qGu+7xScTnWihdFEMhd9f8MMmNgaIjwHwD5RY3c57Ry0nTircx18sT3ek+ISYHr1O/kmKL8DYRUAy2Q9NAhBgLZyU+hV976Xr8fKHFMAx+KNP+GgPwPI1cQ9o8DRwxmvcR9Y97fbZbulABUVW1I6Cvo3E/Bz7b0zFFumd6avPX36+aHx/hxXgKIfbkknpf8jANUJdc0oEK/nzLbcve/5/rF/sbEJFRVbUpKVrzGcFpPSv+cby51Rz88oAToK+jcjWfmJ4HGvf8qfxiZGNEGO6rdWcsJ2cT4ZD87px+6DtR+OHI8KYF+2KQ+BofMApkrxzDh4uEkpHXlFvdkEDQ69gWTliyCXFPNrIwcEAPbqdxwg5TKSQZYogtzE5rr3vdTKAIBDqUGy8kVigcJfAACC08nsp7JbADgkO2U0XC6bvZjZG7LnI1n5MrA7BtorGBS+SLYnhkXFY4yDzZPth1HhRBUMjJfIdsSwcJQy4iiU7YeBKTRjeBhRKGYTw7KqMiytKsX99+ZjanY6aEJjc3cO58B1rx/nrlzH7mMXsOvYeYSUCY8o3imZZF/8FhdpcY4jF+++sgQlM/U1vtPc0oNfvLEfl9t7hdqN6g1NJHMcudizYYXuKh8ASorzsOfNFZjtyBFqV9gdYDYxHN70XFTlDwZD6PL4RbgQxbRcG1It5oi081ev48m1O6CoYhoGc+ws2vDMorKIyg+FVLz+/glsq29CIBgS5UYEVosZP33qQfxm1UKYzcONQdmsqVi2qAwfHflCiA/CmqCnv1sacfz6+yfw3u5GaZUPAIFgCO/uasTvP/gkIv3pytJbnKE9wgS4/9780d8DgRC21TeJMh2TD/afxWDYhfDN2fm3ya0twgTIy04b/d3Z0yf1yh/LYDCEzp6bz6G8KenCbAsTgIW96Ktc6JtvXCjqzRiACQxKhL6GJokmKYBkhL2GxsPSqjL8dvWjmJZr06xMzoGLbR78+u3DOHPhmmblaoVu7oAsmxUba5/QtPIBgAgomZmLDS89oWm5WqEbAaZkpsKSYkpY+VoLqxW6EaCt8wb+cepKwsrfuvc/CSv7TtDNM4BzYPX6vaiqmIXpedr1kHNwNLf0oOGLDs3K1BLdCAAAispx5NPE3QV6RDdNkFFJCiCZpACS0dUzAABMjJCRHv8syb7+oLDBk0SgKwHKS6ejsnwmTKb4b0xFUXH8TKsuo9x40E0TlJ6agqqHiydU+QBgMjFUPVyMNKuurqW40Y0AJhMDscl1AxMjmM2Ji6ITiW4E8PkD+Pxy96TO/exSF3z+gMYeiUFX9+2hf13GmeZrmJKZGvc5Xt+gtFkVWqArAQCgy+P/WlfoRBHWBIWPQpLoeYhxEO6TyBFTYQLc6Bsc/Z2XnSZ03DUWJkaYGjYQ7w3zNdEIE+BS2JzLLJsVT35ntijTMal+ZA4yw4K/i60eYbaFCfDxyUsRx3988XE88uAMUeZvycKHZuAPNd+LSPv4n5dukVt7hM0NzUiz4MRfVkXc6gDw38tdaOm4IcKFKIoLs/HA7GkRaV0ePx795V/hHxh3cRPNETo9vbJ8Jra9thTmCUa7oggpKla+ugufnG0TZlNoTRw/04rV6/fpMmjy+QNYvX6f0MoHBN8BI+Tn2FCzfB5+VFmC/By5g+VdHj/2Hm9G3c5P0e2NWs4n4UgRYARGhPycdOTn2DDJbqBJo3Kgu9eP7t5+qVMlpUbCKufo9PjRaaDIdyz6fBoaiKQAkkkKIBnd9YYSEWy52bBmpMJk1sY9JRRCoG8Qfs8NcJ19m6AbAczWFMyquA9FZfcgxZqYpYuGAkG4zn2JlsbzCAXFRLqx0IUAttwsPLR4IVIzExsTpFgtmFVehoI5M3C2/gT8nq8Sai8epD8DLLZUlC+pTHjlh5OWaUP5U5WwpMc/8pYopAswd8G3YLWlxc6oMdaMNMxZ8IBwu2ORKoAlLRUFc+V1SU8vKYYlzSrNPiBZgBzHNKnDk0SEHHuBNPuAZAFSM8R9j3tLHzLl+iBVAFVRZJof9iEk94NxqQL0e30yzQMA/JJ9kCpAr7tbakA0NBiE1z252XhaIbcJCim42ihmWZjxaGk8D1X8MmURSI8DWs9eRE+b+KnlPa3X0NrULNzuWKQLwFUVTQdP4lpzqzCbHReuounQSV10zOmiL0hVFHx+5N9wnfsSRffdg5yiqbDa0kBMm+uDqyoC/gH0urvhPncF3msxd5cShi4EGMHb0Q1vh9yHomikN0FGhwEIynbCwAQYgD7ZXhgYH+MEfS6iYAw6GFSS/zJsVAgXGEFtkO2HUSFQAwP4UdmOGBVScJS55vtOARA7JTgJALS2LfCeZnA6VQ7aIdsbA7IDTqfKAIA4q0MyHhBJgBivA/4fCQ/vgU5b5fpkHIj4e+3717mAsK4IUtRXAOinl+puhaNHZeroXpKjArQfWufhxNfK8cpAMHphZCdVAIhYYsR38dBnWXN/UAggubdYAiCgzlX/qzfD06J6Q102+xoCdotzyzAcaO+/UTs2Mbo7euezimpKXwni9ULcMgR8PzelP4tjzqg5MOOucuRr3j9UkvXMzr6MUD6SzdEdQUCdq/+rn/kOvzzut7kx5wUWVb+9gohvQnK37YnSDaI1rgO1O2+XKeaImPtg7YewppQBtBmA/r6w1h8BIr6JFF4Wq/KBOO6AcBxLNtpVldUQ+EoA8lfa0BdtALYT43UjQVY8TG5qstPJHA1Z86DiMU5UAY5SAHYM70t5t2+NHsTwKGI7CM0EaiAFR9sWeE/D6ZzwLK//AXXxvjni473DAAAAAElFTkSuQmCC";
