{
  description = "Booster Role Discord Bot (Nix build)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachSystem [ "x86_64-linux" ] (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [
            (self: super: {
              bun = super.bun.overrideAttrs (old: rec {
                version = "1.4.0";
                src = super.fetchzip {
                  url = "https://github.com/oven-sh/bun/releases/download/bun-v1.4.0/bun-linux-x64.zip";
                  sha256 = "sha256:Poy0vf7yJ/hzk33QiQj5gnshI5Q7dfbaMD7xgwiyDKw=";
                };
              });
            })
          ];
        };
      in
      {
        packages.default = pkgs.stdenvNoCC.mkDerivation {
          pname = "booster-role";
          version = "0.1.0";
          src = ./.;

          nativeBuildInputs = [ pkgs.bun ];

          buildPhase = ''
            export HOME="$TMPDIR"
            bun install --frozen-lockfile
            bun run typecheck
            bun test
          '';

          installPhase = ''
            mkdir -p $out/bin $out/lib/booster-role
            cp -r package.json bun.lock tsconfig.json drizzle.config.ts $out/lib/booster-role/
            cp -r src $out/lib/booster-role/src
            cp -r node_modules $out/lib/booster-role/node_modules
            cat > $out/bin/booster-role << WRAPPER
#!${pkgs.runtimeShell}
cd $out/lib/booster-role
export NODE_ENV=production
${pkgs.bun}/bin/bun run db:migrate
exec ${pkgs.bun}/bin/bun run src/index.ts
WRAPPER
            chmod +x $out/bin/booster-role
          '';
        };

        devShells.default = pkgs.mkShell {
          buildInputs = [ pkgs.bun ];
        };
      });
}
