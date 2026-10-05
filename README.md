# Parchís Legendario

## Fuente de Verdad

Este `README.md` es la fuente de verdad sobre que juego se esta construyendo y cuales son sus reglas.

`AGENTS.md` es la fuente de verdad sobre como deben trabajar los agentes de IA dentro de este repositorio.

Si una regla no esta documentada aqui, no debe inventarse ni asumirse automaticamente una variante clasica del Parchis. Antes de implementar comportamiento ambiguo, hay que pedir aclaracion.

## Vision del Juego

Parchís Legendario es un videojuego basado en Parchis.

La intencion no es crear simplemente un Parchis clasico. El juego utiliza las reglas fundamentales del Parchis como motor base y posteriormente añade una capa estrategica propia basada en facciones, personajes unicos, habilidades, posibles casillas o zonas especiales y modificadores de las reglas base.

La primera prioridad de desarrollo es construir un motor de Parchis local completamente funcional. Despues se desarrollara la capa especial del juego.

Las habilidades de los personajes podran crear excepciones explicitas a determinadas reglas base. Cuando una habilidad contradiga explicitamente una regla base, prevalecera la habilidad mientras este activa.

## Estado Actual del Proyecto

El repositorio contiene dos aplicaciones npm independientes. No hay workspace raiz ni `package.json` raiz.

```text
juego/
├─ README.md
├─ AGENTS.md
├─ parchis_front/      # Frontend React
└─ parchis-remix/      # Backend NestJS API
```

### Frontend: `parchis_front`

- Stack: Create React App, React 18, React Router 6, Axios, Bootstrap, React-Bootstrap y `react-dice-complete`.
- Dev server: `npm start`, servido normalmente en `http://localhost:3000`.
- Build: `npm run build`.
- Tests: `npm test -- --watchAll=false`.
- La pantalla de juego actual es un prototipo visual local en React.
- La logica actual de juego no debe considerarse el motor definitivo.

```text
parchis_front/src/
├─ app/          # App y definicion de rutas
├─ api/          # Cliente API existente, actualmente no usado por las pantallas principales
├─ auth/         # Login, registro y PrivateRoute
├─ dashboard/    # Dashboard protegido
├─ game/         # Pantalla de juego, tablero visual, estado local y modal de equipo
├─ styles/       # Estilos globales
├─ index.js
├─ App.test.js
├─ App.css       # Resto CRA conservado
└─ logo.svg      # Resto CRA conservado
```

### Backend: `parchis-remix`

- Stack: NestJS 10, TypeScript, TypeORM, PostgreSQL, JWT y bcrypt.
- Dev server: `npm run start:dev`, servido normalmente en `http://localhost:3001`.
- Build: `npm run build`.
- Tests unitarios: `npm test`.
- Tests e2e: `npm run test:e2e`.
- Actualmente no existe logica de juego en backend.

```text
parchis-remix/src/
├─ auth/          # Registro, login y DTOs de auth
├─ common/guards/ # Guard JWT manual actual
├─ config/        # Config actual extraida sin cambiar valores
├─ dashboard/     # Endpoint protegido /dashboard
├─ health/        # Endpoint raiz actual GET /
├─ users/         # Entidad, enum y servicio de usuarios
├─ app.module.ts
└─ main.ts
```

### Comunicacion Actual

- El frontend llama directamente a `http://localhost:3001/auth/login` y `http://localhost:3001/auth/register`.
- El backend permite CORS desde `http://localhost:3000`.
- El token JWT se guarda en `localStorage` como `token`.
- Las rutas protegidas del frontend comprueban solo que exista `token`; no validan el token contra el backend.

### Configuracion Backend Actual

- PostgreSQL esta configurado en `parchis-remix/src/config/database.config.ts`.
- Host: `localhost`.
- Puerto: `5432`.
- Base de datos: `parchis_remix`.
- Usuario/password: `postgres`/`postgres`.
- `synchronize: true` sigue activo.
- JWT usa el secreto actual `yourSecretKey`.

## Estado Actual de la Pantalla de Juego

La implementacion actual de `parchis_front/src/game` es un prototipo.

Funciona actualmente:

- `/game` carga la pantalla de juego protegida por `PrivateRoute`.
- `/dev_game` carga la misma pantalla sin proteccion.
- El tablero se pinta como una tabla HTML hardcodeada.
- Existen cuatro facciones visuales: verde, roja, azul y amarilla.
- Cada faccion tiene cuatro fichas representadas por emojis.
- `Start` abre un modal de seleccion de equipo.
- Elegir equipo cambia el texto de equipo seleccionado y el color del dado.
- El dado visual se puede lanzar y guarda el ultimo valor en estado React.
- Se puede seleccionar una ficha y moverla manualmente a algunas casillas interactivas.

No esta implementado todavia:

- motor de reglas independiente de React;
- turnos reales;
- movimientos legales por dado;
- salida obligatoria con 5;
- barreras;
- capturas;
- casillas seguras;
- rectas finales;
- meta;
- rebote;
- premios +10 y +20;
- tres seises consecutivos;
- condicion de victoria;
- habilidades de personajes no documentadas expresamente en la seccion de personajes;
- persistencia o multijugador.

## Principio Arquitectonico del Motor

La logica del juego no debe implementarse directamente dentro de componentes React.

Debe existir una separacion clara entre motor/reglas, estado de partida e interfaz React.

El motor sera la fuente de verdad sobre las reglas. React sera responsable principalmente de representar el estado, mostrar el tablero, mostrar personajes, mostrar el dado, resaltar acciones disponibles, recibir decisiones del jugador, enviar acciones al motor y representar el resultado devuelto por el motor.

React no debe decidir directamente que movimientos son legales, que personaje puede moverse, cuando existe una captura, cuando existe una barrera, como funciona el rebote, quien gana, que consecuencias tiene una tirada ni como se resuelve una recompensa.

## Jugadores y Facciones

Las partidas pueden tener 2, 3 o 4 jugadores.

Existen cuatro facciones:

- Verde
- Roja
- Azul
- Amarilla

Cada jugador controla exactamente una faccion. Las facciones que no sean seleccionadas quedan inactivas durante la partida y no reciben turnos.

## Seleccion de Facciones y Orden de Juego

Antes de comenzar la partida se realizan dos sorteos independientes.

### Sorteo 1: Orden de Eleccion de Faccion

El juego determina aleatoriamente el orden en el que los jugadores eligen faccion.

Los jugadores eligen uno por uno. Cuando una faccion ha sido elegida deja de estar disponible para los demas jugadores.

### Sorteo 2: Faccion Inicial

Despues de seleccionar las facciones se realiza un segundo sorteo independiente.

Este sorteo determina unicamente que faccion comienza. No genera una permutacion aleatoria completa de las facciones participantes.

A partir de la faccion inicial, los turnos siguen siempre el ciclo fijo antihorario `Amarilla -> Azul -> Roja -> Verde`, omitiendo las facciones que no participan y volviendo al inicio del ciclo cuando corresponde. El orden de entrada de jugadores o facciones en el estado no altera este ciclo fisico.

Este orden se mantiene durante la partida salvo que en el futuro una habilidad indique explicitamente lo contrario. Sacar un 6 conserva el turno de la misma faccion segun las reglas de repeticion; cuando el turno termina definitivamente se avanza a la siguiente faccion participante del ciclo.

## Personajes

Cada faccion tiene exactamente cuatro personajes exclusivos. Los personajes son las cuatro fichas de Parchis de ese jugador.

### Faccion Verde

- Druida
- Arquero
- Montaraz
- Hada

#### Montaraz: Paso entre barreras

`Paso entre barreras` es una habilidad pasiva y permanente del Montaraz.

El Montaraz puede atravesar barreras aliadas o enemigas situadas en posiciones intermedias de su recorrido. Atravesar una barrera no la destruye ni modifica: los dos personajes que la forman permanecen en su posicion.

La habilidad no permite terminar un movimiento sobre una barrera ni evita ninguna restriccion de destino. La ocupacion maxima, las capturas, los seguros, HOME, META, las rectas finales y el rebote se resuelven mediante las reglas normales.

La excepcion se aplica a los movimientos ordinarios originados por una tirada (`normal`) y a los movimientos de recompensa (`reward`), porque ambos recorren el tablero casilla por casilla. No modifica `forcedDisplacement` ni `specialTraversal`.

La habilidad ignora exclusivamente el bloqueo de recorrido producido por barreras. No ignora ni neutraliza enredaderas, hielo, trampas ni ningun otro `terrainEffect` aplicable.

#### Druida: Enredaderas

`Enredaderas` es una habilidad pasiva y permanente con activacion opcional despues de completar un movimiento `normal` o `reward` del Druida. Si la activacion es valida, el jugador puede activarla u omitirla mediante una decision calculada por el motor.

El Druida dispone de 2 cargas por vida. Activar la habilidad consume exactamente 1 carga y coloca una Enredadera en la posicion final real del movimiento. Puede mantener como maximo 2 Enredaderas activas y no puede colocar otra Enredadera propia en una posicion que ya contenga una suya. Con 0 cargas, con el maximo activo alcanzado, sobre una posicion no jugable o ante un duplicado propio no se genera la decision y no se consume ninguna carga.

Las Enredaderas pueden colocarse en posiciones jugables comunes o de recta final. HOME y META no son posiciones jugables para terrain effects. Cada Enredadera es un `terrainEffect` persistente, tipado y serializable que conserva su posicion, el Druida de origen y la faccion propietaria.

Una Enredadera no afecta a personajes de su faccion. Cuando un enemigo entra, pasa o aterriza sobre ella durante un movimiento `normal` o `reward`, el recorrido se interrumpe exactamente en esa posicion, se descartan los pasos restantes y se consume solo la Enredadera activada. No deja ningun estado en el personaje y no se aplica a `forcedDisplacement`, `specialTraversal` ni `EXIT_HOME`.

Antes de resolver una interrupcion por Enredaderas, el recorrido completo solicitado y su destino teorico deben ser legales segun las reglas base. Una Enredadera puede interrumpir un movimiento legal, pero nunca convertir en legal un movimiento bloqueado por una barrera posterior u otra restriccion del destino teorico. Despues de la interrupcion, su posicion se resuelve como destino efectivo mediante las mismas reglas ordinarias de ocupacion, barreras, seguros y captura. La Enredadera no captura por si misma, no envia a HOME, no produce dano y no crea ni destruye barreras. Una barrera situada en el destino efectivo sigue haciendo ilegal ese movimiento. `Paso entre barreras` no permite al Montaraz ignorar Enredaderas, y `Captura en tabernas` sigue aplicandose al Asesino si la interrupcion produce un destino seguro con una captura legal.

Cuando el Druida es capturado mediante un evento `characterCaptured`, vuelve a HOME por la regla normal, recupera sus 2 cargas y se eliminan todas las Enredaderas creadas por ese Druida. No se eliminan terrain effects de otros propietarios. Otros retornos a HOME, incluida la penalizacion por tres 6 o una eliminacion durante salida, no recargan la habilidad ni limpian sus Enredaderas. La captura del Druida conserva la recompensa base de +20 para la faccion capturadora.

### Faccion Roja

- Mago de fuego
- Guerrero
- Herrero
- Asesino

#### Asesino: Captura en tabernas

`Captura en tabernas` es una habilidad pasiva y permanente del Asesino.

Las tabernas son las casillas seguras definidas por `SAFE_SQUARES`. Cuando el Asesino termina legalmente un movimiento sobre una casilla segura ocupada por exactamente un enemigo, captura a ese enemigo en lugar de coexistir con el mediante la regla base de seguro.

La habilidad se aplica a movimientos `normal` y `reward`, porque ambos utilizan las reglas ordinarias de destino y captura. No se aplica a `forcedDisplacement`, `specialTraversal` ni `EXIT_HOME`.

La excepcion solo se consulta para la casilla final. Pasar sobre un enemigo situado en una casilla segura no produce captura.

La casilla conserva su condicion de segura. La habilidad no modifica `SAFE_SQUARES`, no afecta a otros personajes y no concede inmunidad ni proteccion al Asesino.

La habilidad no permite atravesar barreras, aterrizar sobre dos ocupantes, superar la ocupacion maxima ni destruir una barrera. Una captura realizada en una casilla segura produce el evento `characterCaptured` ordinario y concede la recompensa base de +20 a la faccion Roja mediante el sistema normal de `movementReward`.

### Faccion Azul

- Mago de hielo
- Cazador
- Alquimista
- Clerigo

#### Mago de hielo: Congelacion

`Congelacion` es una habilidad pasiva y permanente con activacion opcional despues de completar un movimiento `normal` o `reward` del Mago de hielo. Dispone de 2 cargas por vida y cada activacion consume exactamente 1 carga. `forcedDisplacement`, `specialTraversal` y `EXIT_HOME` no permiten activarla.

La habilidad se aplica sobre la posicion inmediatamente anterior del recorrido real completado. Esa posicion se deriva del path efectivo resuelto por el motor, nunca mediante aritmetica sobre el numero de casilla ni mediante el destino teorico. En un movimiento de un paso la posicion anterior es el origen. Si terrain interrumpe el movimiento se utiliza el recorrido truncado real. Si no existe una posicion anterior jugable, no quedan cargas o la ocupacion no permite una aplicacion definida, no se ofrece la activacion.

Si la posicion anterior esta vacia, activar `Congelacion` crea un `terrainEffect` de tipo `ice` asociado al Mago, su faccion, la habilidad y la posicion. Si contiene un unico enemigo identificable, aunque comparta una casilla segura con un aliado Azul, la activacion aplica `frozen` directamente a ese enemigo sin capturarlo, desplazarlo ni crear Hielo persistente. Si solo contiene aliados, la activacion no esta disponible. Si contiene dos enemigos, el jugador elige mediante acciones autoritativas cual recibe `frozen`; no se congela a ambos con una sola carga.

El Hielo no afecta a aliados de su faccion. El primer enemigo que entra, pasa o aterriza en su posicion durante un movimiento `normal` o `reward` se detiene exactamente alli, pierde los pasos restantes, recibe `frozen` y consume ese Hielo. Hielo y Enredaderas son terrain effects independientes y se resuelve solamente el primer efecto hostil aplicable segun el orden del recorrido. Antes de cualquier interrupcion se valida el recorrido solicitado completo y su destino teorico: terrain puede interrumpir un movimiento legal, pero nunca convertir uno ilegal en legal.

`Frozen` es un estado persistente, serializable y no acumulable asociado al personaje afectado. Modifica exclusivamente su siguiente movimiento `normal`: los pasos efectivos son `ceil(resultadoDelDado / 2)`, por lo que 1→1, 2→1, 3→2, 4→2, 5→3 y 6→3. Esos pasos efectivos recorren despues el flujo normal de barreras, destinos, SAFE, capturas y terrain. Evaluar movimientos, calcular acciones disponibles o revalidar no consume el estado; se elimina unicamente al ejecutar autoritativamente el movimiento normal que realmente utilizo la reduccion. Si durante ese movimiento el personaje activa otro Hielo, el estado anterior se consume y el nuevo `frozen` queda aplicado sin stacks.

Los movimientos `reward`, `forcedDisplacement`, `specialTraversal`, movimientos especiales y `EXIT_HOME` no reducen sus pasos ni consumen `frozen`. El resultado original del dado se conserva para salida con 5, repeticion por 6, seises consecutivos y cualquier regla externa al desplazamiento; por ejemplo, un 6 mueve 3 a un personaje congelado pero sigue siendo un 6 para el turno.

Cuando el Mago de hielo es capturado recupera sus 2 cargas y se eliminan exclusivamente los Hielos persistentes creados por ese Mago. Los estados `frozen` que ya hubiera aplicado a enemigos no desaparecen por su captura y permanecen hasta ser consumidos por el siguiente movimiento normal de cada afectado.

Cuando el Mago de hielo es capturado recupera sus 2 cargas y se eliminan exclusivamente los Hielos persistentes creados por ese Mago. Los estados `frozen` que ya hubiera aplicado a enemigos no desaparecen por su captura y permanecen hasta ser consumidos por el siguiente movimiento normal de cada afectado.

#### Cazador: Trampa

`Trampa` es una habilidad pasiva y permanente con activacion opcional despues de completar un movimiento `normal` o `reward` del Cazador. Dispone de 2 cargas por vida y cada activacion consume exactamente 1 carga. `forcedDisplacement`, `specialTraversal` y `EXIT_HOME` no permiten activarla.

La habilidad coloca una Trampa en la posicion inmediatamente anterior del recorrido real completado por el Cazador. Esa posicion se deriva del path efectivo resuelto por el motor, nunca mediante aritmetica sobre el numero de casilla ni mediante el destino teorico. En un movimiento de un paso la posicion anterior es el origen. Si terrain interrumpe el movimiento se utiliza el recorrido truncado real. Si no existe una posicion anterior jugable, no se ofrece la activacion.

Si la posicion anterior esta vacia o contiene solo aliados, la Trampa se crea como `terrainEffect` persistente asociado al Cazador, su faccion, la habilidad y la posicion. Si contiene un enemigo, la activacion no esta disponible.

El primer enemigo que ENTRE o PASE por esa casilla durante un movimiento `normal` o `reward`:
1. se detiene exactamente en ella;
2. termina inmediatamente su movimiento;
3. pierde los pasos restantes;
4. la Trampa desaparece;
5. recibe SANGRADO.

Los aliados del Cazador pueden entrar/pasar por la Trampa sin activarla ni consumirla.

`Sangrado` es un estado persistente, serializable y no acumulable asociado al personaje afectado. Al recibirlo comienza con `remainingTurns = 3`. El contador decrementa unicamente al FINALIZAR cada turno de la FACCION del personaje afectado (3 → 2 → 1 → muerte). Evaluar movimientos, calcular acciones disponibles o revalidar no consume el contador; solo la progresion natural de turnos lo reduce.

Cuando el contador llega a 0 al finalizar un turno de su faccion, si el personaje NO se ha curado previamente:
- muere y vuelve a HOME;
- NO es una captura;
- NO concede +20;
- no existe personaje capturador.

Una ficha con Sangrado se cura si TERMINA un movimiento en una casilla SAFE/taberna. Pasar por una SAFE no cura. Debe terminar realmente alli. Al curarse, se elimina Sangrado y deja de participar en el contador.

Si una ficha que YA tiene Sangrado activa otra Trampa:
- se detiene igualmente;
- la nueva Trampa se consume;
- NO recibe un segundo Sangrado;
- NO se reinicia el contador;
- NO recupera remainingTurns;
- NO se modifica el Sangrado existente.

La Trampa es un tercer terrain effect independiente junto a Enredaderas e Hielo. Mantiene la semántica de FASE 1.3C: se valida el recorrido completo solicitado y su destino teorico antes de resolver terrain. Una Trampa nunca puede convertir un movimiento ilegal en legal. Montaraz NO es inmune a Trampas. MovementReward puede activar una Trampa normalmente.

Cuando capturan al Cazador:
- vuelve a HOME normalmente;
- recupera sus 2 cargas;
- desaparecen unicamente las Trampas activas creadas por ese Cazador.
Los Sangrados que el Cazador ya haya aplicado a enemigos permanecen activos.

#### Alquimista: Mareo

`Mareo` es una habilidad pasiva y permanente con activacion opcional despues de completar un movimiento `normal` o `reward` del Alquimista. Dispone de 2 pociones por vida y cada activacion consume exactamente 1 pocion. `forcedDisplacement`, `specialTraversal` y `EXIT_HOME` no permiten activarla.

Despues de un movimiento valido del Alquimista, si termina exactamente a 1 casilla de distancia de uno o mas enemigos (ya sea por DELANTE o por DETRAS segun el recorrido canónico), puede gastar 1 pocion para aplicar MAREO a uno de ellos. Si hay varios enemigos elegibles, el jugador elige cual recibe Mareo.

La referencia delante/detras debe respetar el recorrido/direccion canónica del tablero. No se usan diferencias aritmeticas de IDs.

MAREO permanece sobre esa ficha hasta la proxima vez que sea seleccionada para realizar su movimiento normal.

Cuando una ficha con Mareo sea seleccionada para realizar su siguiente movimiento normal:
- en vez de avanzar normalmente, mueve el DOBLE del resultado del dado HACIA ATRAS (direccion opuesta a su avance normal).
- Ejemplos: 1→2, 2→4, 3→6, 4→8, 5→10, 6→12 casillas hacia atras.
- Despues de ejecutar ese movimiento, Mareo desaparece.
- Este desplazamiento sigue siendo MOVIMIENTO NORMAL (no forcedDisplacement ni specialTraversal).
- Debe interactuar normalmente con barreras, Montaraz, Enredaderas, Hielo, Trampas, SAFE, ocupacion, capturas.
- El resultado original del dado se conserva para repeticion por 6, seises consecutivos, historial.

La adyacencia de 1 casilla se calcula mediante la topologia canonica (recorrido inverso y directo del Alquimista).

Mareo NO es una captura. Un enemigo en SAFE/taberna puede recibir Mareo si cumple la condicion de distancia. No hay captura, desplazamiento inmediato, ni +20.

Si una ficha ya tiene Mareo y recibe otro: NO acumula, NO duplica, NO reinicia.

Cuando capturan al Alquimista:
- vuelve a HOME normalmente;
- recupera sus 2 pociones.
Los Mareos ya aplicados a enemigos permanecen activos.

- Paladin
- Monje
- Ladron
- Ingeniero

El resto de habilidades de personaje se definira e implementara de forma incremental. No debe asumirse ninguna habilidad que no este documentada expresamente en este README.

El motor debe diseñarse sabiendo que una ficha no es simplemente un token generico: representa un personaje con identidad propia y podra tener reglas o modificadores particulares.

## Estado Inicial

Los cuatro personajes de cada faccion comienzan en casa.

Un personaje que esta en casa no se considera dentro del recorrido.

Los personajes en casa no pueden recibir movimientos de recompensa.

Cada faccion dispone de una unica salida inicial especial por partida. Una vez utilizada, la salida normal con 5 vuelve a ser la unica forma base de sacar personajes de casa.

## Salida de Casa

### Primera salida de cada faccion

Cada faccion comienza la partida con una salida inicial especial disponible. Esta ventaja pertenece a la faccion, es independiente para cada faccion y no se recupera aunque el personaje que la utilizo vuelva posteriormente a HOME.

La ventaja se consume unicamente cuando la salida se ejecuta legalmente. Consultar acciones disponibles, tomar decisiones o revalidar una accion no la consume.

Con un resultado de 1, 2, 3, 4 o 6, el jugador elige un personaje propio en HOME. El personaje sale gratuitamente a START y realiza inmediatamente desde START un movimiento `normal` hacia delante con el valor completo del dado. START es solo el origen logico de ese movimiento: sus ocupantes no son desplazados ni capturados. El recorrido posterior aplica normalmente barreras, destino, terrain, capturas, ocupacion y modificadores. Primero se valida el recorrido y destino pretendidos completos y solo despues puede interrumpirlo terrain. Si el movimiento completo no es legal, esa opcion no puede ejecutarse y la ventaja no se consume.

Ejemplo rojo con resultado 4:

```text
HOME -> START/common 5 -> 6 -> 7 -> 8 -> 9
```

El personaje termina en `common 9`.

El resultado original del dado se conserva. En particular, una primera salida con 6 conserva la repeticion, el recuento de seises consecutivos y el historial correspondiente al 6.

Con un resultado de 5, el jugador selecciona secuencialmente dos personajes propios distintos en HOME, o el unico disponible si solo queda uno. Los seleccionados terminan en START y no realizan cinco pasos adicionales. No puede seleccionarse dos veces el mismo personaje.

Cuando existen al menos dos personajes en HOME, el motor ofrece primero una accion individual por cada personaje elegible. Al ejecutar la primera seleccion, ese personaje se coloca inmediatamente en START y la faccion conserva temporalmente la ventaja mientras queda registrada una resolucion parcial serializable con la identidad del primer personaje. El turno permanece obligado a completar la salida y ofrece acciones individuales unicamente para los demas personajes que siguen en HOME. No existe cancelacion despues de la primera seleccion.

Al ejecutar autoritativamente la segunda seleccion, el segundo personaje se coloca junto al primero, se elimina la resolucion parcial y se consume la salida inicial. Una accion manipulada u obsoleta para la segunda seleccion se rechaza sin modificar el estado parcial ni consumir la ventaja.

Cuando salen dos personajes con este 5 especial, la primera seleccion libera todas las posiciones necesarias de START: si habia un ocupante previo, vuelve a HOME; si habia dos, ambos vuelven a HOME. Esto se aplica independientemente de sus facciones. Estas eliminaciones son muertes involuntarias, no capturas, y no conceden +20. La primera ficha nueva permanece en START durante la resolucion parcial y no se considera un ocupante previo al ejecutar la segunda seleccion. Al finalizar, los dos personajes recien salidos quedan juntos en START y forman inmediatamente una barrera propia.

Si solo queda un personaje en HOME, se aplican las reglas de ocupacion compatibles con una salida normal de un unico personaje: con dos ocupantes en START, el jugador elige uno para devolverlo a HOME; con cero o uno, no es necesario desplazar a nadie.

Despues de consumir esta ventaja, los resultados 1, 2, 3, 4 y 6 no permiten sacar personajes de HOME y el resultado 5 utiliza exclusivamente la salida normal descrita a continuacion.

### Salida normal con 5

Cuando un jugador obtiene un 5 y todavia tiene uno o mas personajes en casa:

- esta obligado a sacar un personaje;
- unicamente los personajes que esten en casa deben mostrarse como seleccionables;
- el jugador elige cual de ellos quiere sacar;
- el personaje se coloca en la casilla de salida correspondiente a su faccion.

Si no quedan personajes en casa, el 5 se utiliza como un movimiento normal.

Una salida obligatoria por obtener un 5 nunca puede ser bloqueada por una barrera.

Si la casilla de salida contiene dos personajes y debe salir un nuevo personaje:

Esta regla se aplica siempre que la casilla de salida contenga dos personajes, independientemente de sus facciones y de si dichos personajes forman o no una barrera.

- el jugador activo elige cual de los dos personajes existentes es eliminado;
- el personaje eliminado vuelve a su casa;
- el personaje que acaba de salir ocupa su lugar;
- el otro ocupante permanece en la casilla.

Esto se aplica independientemente de las facciones de los dos personajes que ocupan la casilla de salida.

Esta eliminacion se considera una muerte involuntaria provocada por la salida y no una captura. Por tanto, no concede la recompensa de +20.

Toda decision necesaria para resolver esta situacion la toma el jugador activo para evitar interrumpir el turno solicitando decisiones a otro jugador.

## Tablero Base y Recorridos

El recorrido comun utiliza 68 casillas numeradas del 1 al 68.

El movimiento sigue el orden `1 -> 2 -> 3 -> ... -> 68 -> 1`.

Las salidas son:

- Amarillo: 39
- Verde: 22
- Azul: 56
- Rojo: 5

Cada faccion completa su recorrido correspondiente antes de entrar en su recta final.

Recorrido amarillo:

```text
39 -> 40 -> ... -> 68 -> 1 -> ... -> 38 -> recta final amarilla
```

Ultima casilla comun: 38.

Recorrido verde:

```text
22 -> 23 -> ... -> 68 -> 1 -> ... -> 21 -> recta final verde
```

Ultima casilla comun: 21.

Recorrido azul:

```text
56 -> 57 -> ... -> 68 -> 1 -> ... -> 55 -> recta final azul
```

Ultima casilla comun: 55.

Recorrido rojo:

```text
5 -> 6 -> ... -> 68 -> 1 -> ... -> 4 -> recta final roja
```

Ultima casilla comun: 4.

## Casillas Seguras

Se utiliza la misma distribucion base de seguros que el Parchis clasico.

Las casillas seguras son: 5, 12, 17, 22, 29, 34, 39, 46, 51, 56, 63 y 68.

Las cuatro casillas de salida son por tanto tambien casillas seguras.

Visualmente los seguros deberan distinguirse del resto mediante algun simbolo, por ejemplo un circulo u otro indicador. El simbolo utilizado es una decision de UI y no forma parte de las reglas del motor.

## Ocupacion de Casillas

Una casilla puede contener como maximo dos personajes. Esto se aplica tambien a las casillas seguras.

Dos personajes de la misma faccion pueden compartir una casilla. Cuando lo hacen forman una barrera.

En una casilla segura pueden coexistir dos personajes de facciones diferentes sin que se produzca una captura. La excepcion es `Captura en tabernas`: el Asesino captura cuando termina un movimiento `normal` o `reward` sobre exactamente un enemigo en esa casilla.

En una casilla normal, dos personajes enemigos no pueden coexistir.

Si un personaje termina legalmente su movimiento en una casilla normal ocupada por un enemigo, se produce una captura salvo que una habilidad indique explicitamente lo contrario.

## Barreras

Dos personajes de la misma faccion situados en la misma casilla forman una barrera.

Las barreras son infranqueables.

Un movimiento es ilegal si necesita atravesar una barrera, terminar sobre una barrera o alcanzar una posicion situada despues de una barrera atravesandola.

Las barreras bloquean tambien a personajes de la misma faccion.

El motor debe comprobar todo el recorrido del movimiento y no unicamente la casilla de destino.

Las excepciones actualmente definidas son la salida obligatoria por obtener un 5 y `Paso entre barreras` del Montaraz, limitada a barreras situadas en posiciones intermedias de movimientos `normal` o `reward`.

## Barreras y Tirada de 6

Cuando un jugador obtiene un 6 y tiene una o mas barreras propias:

- esta obligado a intentar romper una barrera;
- para hacerlo debe mover uno de los personajes que forman una barrera.

Una barrera se considera rota únicamente si, después de completar el movimiento, los dos personajes que la formaban dejan de ocupar la misma casilla.

Un movimiento que termine dejando a ambos personajes nuevamente en la misma casilla no se considera una ruptura legal de barrera.

Si existen varios movimientos legales que rompen barreras, el jugador puede elegir entre ellos.

Si ninguna barrera puede romperse legalmente con ese 6, se calculan los movimientos legales normales del resto de personajes y el jugador puede elegir uno de ellos.

En este caso, "resto de personajes" se refiere exclusivamente a los personajes de la facción que no forman parte de ninguna barrera propia. Los personajes que forman una barrera propia no participan en este cálculo de movimientos normales.

Si tampoco existe ningun movimiento legal, no se mueve ningun personaje.

En todos los casos, haber obtenido un 6 concede una nueva tirada.

## Movimiento y Seleccion

Una tirada de dado representa el numero de casillas que puede mover un unico personaje, salvo la excepcion explicita de la primera salida de una faccion con resultado 5.

Una tirada nunca puede dividirse entre varios personajes. La primera salida con 5 no divide sus cinco pasos: coloca hasta dos personajes en START sin movimiento posterior.

Despues de tirar el dado, el motor debe calcular todos los personajes que pueden realizar legalmente ese movimiento.

La interfaz debera resaltar unicamente esos personajes.

El jugador solo puede seleccionar un personaje disponible.

Si existe al menos un movimiento legal, el jugador esta obligado a realizar uno.

Solo se pierde el movimiento cuando no existe ninguna opcion legal.

El motor, y no React, debe determinar que personajes tienen movimientos legales.

El rebote en meta se considera un movimiento legal. Por tanto, superar temporalmente la meta durante el recorrido no convierte a un personaje en no disponible.

## Dado y Turnos

El dado base utiliza valores del 1 al 6.

Un 6 siempre equivale a exactamente 6 movimientos. Nunca se convierte en 7 aunque todos los personajes hayan salido de casa.

Cuando un jugador obtiene un 6:

- realiza el movimiento si existe alguno legal;
- resuelve completamente las consecuencias y recompensas de ese movimiento;
- despues vuelve a tirar.

Si no existe ningun movimiento legal para el 6:

- no mueve;
- conserva igualmente el derecho a volver a tirar.

El 6 cuenta para la secuencia de tres seises aunque no se haya podido mover ningun personaje.

## Tres Seises Consecutivos

Los seises consecutivos se contabilizan dentro del mismo turno.

Al obtener el tercer 6 consecutivo:

- el jugador no realiza un movimiento correspondiente a ese tercer 6;
- se activa inmediatamente la penalizacion;
- el turno termina.

El tercer 6 no genera ningun movimiento. Por tanto, no puede provocar capturas, llegada a meta ni generar nuevas recompensas. Cualquier recompensa pendiente anterior se considera resuelta antes de realizar la siguiente tirada de dado.
Para determinar que personaje es penalizado:

- se mantiene un historial de personajes que hayan realizado movimientos durante ese turno;
- se consulta desde el movimiento mas reciente hacia atras;
- el primer personaje encontrado que siga activo en el tablero vuelve a casa;
- los personajes que ya hayan llegado a meta estan protegidos y se ignoran;
- si ninguno de los personajes movidos durante ese turno sigue disponible, nadie vuelve a casa.

Solo deben considerarse personajes que hayan realizado realmente un movimiento originado por una tirada de dado durante ese turno.
Los movimientos realizados mediante recompensas tambien forman parte del historial general de movimientos del turno, pero no alteran el orden usado para aplicar la penalizacion por tres 6 consecutivos.

Esto incluye tanto los movimientos de recompensa por captura (+20 base) como los movimientos de recompensa por llegada a meta (+10): son movimientos reales para capturas, barreras, meta y recompensas encadenadas, pero se ignoran al buscar que personaje debe volver a casa por el tercer 6.

Por tanto, al buscar el personaje que debe ser penalizado, siempre se consulta el historial desde el movimiento originado por dado mas reciente hacia atras.

## Capturas

Por regla base, una captura ocurre unicamente cuando un personaje termina su movimiento en una casilla normal ocupada por un personaje enemigo. `Captura en tabernas` permite al Asesino producir esa misma captura ordinaria cuando el destino final es una casilla segura ocupada por exactamente un enemigo.

Pasar por encima de un personaje enemigo durante un movimiento no provoca captura.

Las habilidades podran crear excepciones a esta regla.

Cuando se produce una captura:

- el personaje capturado vuelve a casa;
- la faccion que realizo la captura obtiene una recompensa base de +20 movimientos.

Los +20 pertenecen a la faccion capturadora, no obligatoriamente al personaje que realizo la captura.

El jugador debe elegir que personaje propio valido recibe los +20.

Si solo existe un destinatario valido, la recompensa puede resolverse automaticamente con ese personaje.

Si existen varios destinatarios validos, el motor debe solicitar una eleccion.

Si no existe ningun destinatario valido, la recompensa se pierde por completo y no se almacena para utilizarla posteriormente.

Los personajes en casa y los personajes que ya estan en META no pueden recibir esta recompensa.

Los enemigos nunca pueden recibir la recompensa de +20.

El movimiento de recompensa es un movimiento real y debe respetar barreras, seguros, rectas finales, rebote, ocupacion maxima y demas reglas del motor.

La recompensa de +20 constituye un único movimiento indivisible.

El personaje elegido debe poder realizar legalmente los 20 movimientos completos. Los +20 no pueden realizarse parcialmente ni repartirse entre varios personajes.

No existe fallback de 20 -> 19 -> 18 -> ... -> 1. Si un personaje no puede ejecutar legalmente el movimiento exacto de 20, no es destinatario valido para esa recompensa.

Los movimientos de recompensa pueden provocar nuevas capturas. Las capturas pueden encadenarse sin un limite artificial.

Cada captura se resuelve completamente antes de continuar con la siguiente consecuencia.

Una habilidad podra modificar en el futuro la recompensa base de +20.

## Recompensas y Tiradas

Las recompensas son independientes de las tiradas del dado.

Resolver una recompensa:

- no consume una tirada pendiente;
- no cancela una repeticion obtenida por sacar 6;
- no cuenta como una nueva tirada;
- no afecta directamente al contador de seises consecutivos.

Ejemplo:

```text
6 -> movimiento -> captura -> +20 -> otra captura -> +20 -> resolucion completa -> nueva tirada por el 6 original
```

## Rectas Finales

Cada faccion tiene una recta final exclusiva.

Solo los personajes de esa faccion pueden entrar en ella.

Cada recta final contiene 7 casillas.

Despues de esas 7 casillas existe una posicion adicional denominada META.

Modelo conceptual:

```text
CASA -> RECORRIDO COMUN -> RECTA FINAL 1 -> ... -> RECTA FINAL 7 -> META
```

Una vez dentro de la recta final:

- los enemigos no pueden entrar;
- no existen capturas entre facciones;
- el personaje no vuelve al recorrido comun;
- el rebote ocurre exclusivamente dentro de la recta final.

Dos personajes de la misma faccion pueden ocupar la misma casilla de su recta final. En ese caso forman una barrera y pueden bloquear a los personajes propios que vengan por detras.

## Meta y Rebote

Para entrar definitivamente en meta es necesario que el movimiento termine exactamente en META.

Si existen movimientos sobrantes, el personaje rebota.

Ejemplo conceptual:

```text
Si un personaje esta a 2 movimientos de META y debe mover 4:
posicion -> recta 7 -> META -> recta 7 -> recta 6
```

El personaje termina en recta 6.

Pasar temporalmente por META durante un rebote no significa haber terminado. El movimiento debe consumirse completamente.

Esta regla tambien se aplica a movimientos de recompensa como +10 y +20.

### Limite del rebote

El rebote se produce unicamente al alcanzar META con movimientos sobrantes.

Durante el rebote, el personaje retrocede por su propia recta final.

No existe un segundo rebote al alcanzar el inicio de la recta final.

Si los movimientos restantes obligasen al personaje a retroceder mas alla de `finalLane 1`, el movimiento completo se considera ilegal.

Por tanto, un personaje solo puede realizar un movimiento con rebote si puede consumir todos los pasos permaneciendo dentro de su recta final.

Esta regla se aplica independientemente del origen del movimiento.

Si el movimiento procede de una tirada de dado, ese personaje no se considera disponible para dicha tirada.

Si el movimiento procede de una recompensa indivisible como +10 o +20, se aplican las reglas correspondientes de dicha recompensa cuando el movimiento no puede completarse legalmente.

### Ocupacion de META

META no se considera una casilla normal a efectos de ocupacion.

No esta sujeta al limite maximo de dos personajes por casilla. Los cuatro personajes de una misma faccion pueden encontrarse finalizados en META simultaneamente.

Los personajes que han llegado exactamente a META se consideran finalizados y dejan de ocupar una posicion jugable del tablero.

## Premio por Llegar a Meta

Cuando un personaje llega exactamente a META:

- queda marcado como finalizado;
- deja de participar en movimientos normales;
- no puede volver a casa;
- el jugador obtiene una recompensa base de +10 movimientos.

Excepcion: si esa llegada a META hace que los cuatro personajes de la faccion del jugador esten en META, la victoria tiene prioridad absoluta. En ese caso la partida termina inmediatamente y no se genera ni se resuelve la recompensa de +10 correspondiente a esa llegada ganadora.

El jugador elige que otro personaje de su faccion recibe los +10.

El personaje elegido debe estar fuera de casa, seguir activo y poder realizar legalmente el movimiento de +10.

Los personajes en casa no pueden recibir esta recompensa.

Si ningun personaje puede realizar legalmente los +10 movimientos, la recompensa se pierde y no se almacena para turnos posteriores.

Los +10 constituyen un movimiento real y pueden provocar capturas. Una captura producida por esos +10 genera normalmente su recompensa de +20.

## Victoria

Cuando los cuatro personajes de una faccion han llegado a META:

- ese jugador gana inmediatamente;
- la partida termina.

La victoria se aplica inmediatamente aunque ocurra durante un movimiento de recompensa, ya sea +20 o +10. En cuanto existe un ganador, se detiene la resolucion de consecuencias: no se procesan recompensas pendientes, no se solicitan nuevas elecciones de recompensa, no se realizan movimientos posteriores y no se genera `rewardLost` por recompensas descartadas debido a la victoria.

Los eventos ya producidos antes de detectar la victoria se conservan.

No existe actualmente ninguna condicion adicional de victoria.

## Habilidades y Excepciones

Las habilidades de los personajes se diseñan e implementan de forma incremental. Las habilidades implementadas son `Paso entre barreras` del Montaraz, `Captura en tabernas` del Asesino, `Enredaderas` del Druida y `Congelacion` del Mago de hielo, definidas en la seccion de personajes.

El motor debe prepararse para que una habilidad pueda modificar reglas concretas sin duplicar o reescribir el motor completo.

Ejemplos conceptuales de futuras excepciones:

- un Arquero podria atacar a distancia;
- un personaje podria modificar la recompensa de captura;
- un personaje podria interactuar de forma especial con barreras;
- un personaje podria modificar determinadas reglas de movimiento.

Estos ejemplos, salvo las habilidades documentadas expresamente como reglas oficiales, no significan que otras habilidades esten aprobadas ni deban implementarse. Solo ilustran el tipo de extensibilidad que debera soportar el motor.

La regla general sera:

```text
REGLA BASE + MODIFICADOR/EXCEPCION EXPLICITA DEL PERSONAJE = RESULTADO FINAL
```

## Arquitectura Objetivo del Motor

No implementar esta arquitectura todavia, pero la implementacion futura debera buscar una separacion similar a:

```text
src/game/
  engine/
    board/
    state/
    movement/
    rules/
    turns/
  components/
  hooks/
```

Los nombres exactos de archivos pueden adaptarse cuando se implemente.

Priorizar:

- funciones puras;
- reglas independientes de React;
- estado explicito;
- resultados deterministas cuando no intervenga aleatoriedad;
- tests unitarios del motor;
- pequeñas funciones con responsabilidades claras.

Evitar un unico archivo gigante con todas las reglas.

## Tests Esperados del Motor

Cuando se implemente el motor, las reglas base deberan tener tests unitarios.

Los tests deberan cubrir especialmente:

- salida con 5;
- salida bloqueada;
- movimientos legales e ilegales;
- barreras;
- seguros;
- capturas;
- capturas encadenadas;
- recompensa +20;
- llegada a recta final;
- rebote;
- recompensa +10;
- llegada a meta;
- turnos;
- repeticion por 6;
- tres 6 consecutivos;
- ausencia de movimientos legales;
- condicion de victoria.

## Roadmap de Desarrollo

FASE 1: Motor base de Parchis independiente de React.

FASE 2: Tests completos del motor.

FASE 3: Integracion del motor con la interfaz React existente.

FASE 4: Partida local completa para 2, 3 y 4 jugadores.

FASE 5: Diseño e implementacion de los 16 personajes y sus habilidades.

FASE 6: Mecanicas especiales del juego y posibles casillas/zonas especiales.

FASE 7: Solo posteriormente considerar funcionalidades como persistencia de partidas, multijugador, WebSockets, matchmaking o validacion server-side.

## Ideas de Diseño Heredadas

La documentacion anterior describia una ambientacion fantastica con un torneo de Parchis, tablero flotante, criaturas miticas, castillos, entornos como fortaleza, bosque encantado y volcan, menus, HUD, accesibilidad, musica y efectos de sonido.

Estas ideas siguen siendo utiles como inspiracion visual y de producto, pero no sustituyen las reglas definidas en este README.

La documentacion anterior tambien mencionaba Unity y C# como tecnologia objetivo. Esa informacion queda superada por el estado tecnico actual: el proyecto existente usa React en frontend y NestJS en backend.

La lista antigua de personajes y habilidades queda superada por las facciones, personajes y habilidades definidos expresamente en este README. Las habilidades restantes se diseñaran mas adelante.
