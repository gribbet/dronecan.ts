# Dronecan.ts

TypeScript implementation of the [DroneCAN](https://dronecan.github.io) protocol.

[Example](https://github.com/gribbet/dronecan.ts-example)

## Usage overview

### Define protocol schema
```ts
export const schema = {
  messages: [
    message({
      id: 341,
      type: "uavcan.protocol.NodeStatus",
      definition: {
        uptimeSec: uint(32),
        health: enumeration(2, ["ok", "warning", "error", "critical"] as const),
        mode: enumeration(3, [
          "operational",
          "initialization",
          "maintenance",
          "software update",
          4,
          5,
          6,
          "offline",
        ] as const),
        subMode: uint(3),
        vendorSpecificStatusCode: uint(16),
      },
    }),
  ],
  services: [],
} as const;
```
### Broadcast
```ts
 dronecan.broadcast("uavcan.protocol.NodeStatus", {
    uptimeSec: 0,
    health: "ok",
    mode: "operational",
    subMode: 0,
    vendorSpecificStatusCode: 0,
  })
```
### Request
```ts
const info = await dronecan.request("uavcan.protocol.GetNodeInfo", destinationId, {});
```

### Respond
```ts
dronecan.onRequest("uavcan.protocol.GetNodeInfo", () => ({
  status: {
    uptimeSec: 0,
    health: "ok",
    mode: "operational",
    subMode: 0,
    vendorSpecificStatusCode: 0,
  },
  softwareVersion: {
    major: 1,
    minor: 0,
    optionalFieldFlags: 0,
    vcsCommit: 0,
    imageCrc: 0n,
  },
  hardwareVersion: {
    major: 1,
    minor: 0,
    uniqueId: new Uint8Array(new Array(16)),
    certificateOfAuthenticity: new Uint8Array(),
  },
  name: "",
});
```
