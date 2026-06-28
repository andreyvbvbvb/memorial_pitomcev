import * as THREE from "three";

export function resolveObjectTransformInParent(
  object: THREE.Object3D,
  parent: THREE.Object3D
) {
  parent.updateWorldMatrix(true, false);
  object.updateWorldMatrix(true, false);

  const position = new THREE.Vector3();
  object.getWorldPosition(position);
  parent.worldToLocal(position);

  const parentQuaternion = new THREE.Quaternion();
  const objectQuaternion = new THREE.Quaternion();
  parent.getWorldQuaternion(parentQuaternion);
  object.getWorldQuaternion(objectQuaternion);

  const quaternion = parentQuaternion
    .invert()
    .multiply(objectQuaternion)
    .normalize();

  return { position, quaternion };
}
