//
// Init XR
//
import * as THREE from 'three';
import { XRControllerModelFactory } from './webxr/XRControllerModelFactory.js';
import { VRButtonIcon } from './webxr/VRButtonIcon.js';

let vrButton;
let cpmatrix, fov;

let beam;
const beam_color = 0xffffff;
const beam_hilight_color = 0x222222;

let cb_DisplayFloor;
let cb_DisplayFloorStatus;

//
// Init
//
async function initXR() {
  vrButton = VRButtonIcon.createButton(renderer); 

  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType( 'local' );
  renderer.xr.setFramebufferScaleFactor( 4.0 );

  let cpos = new THREE.Vector3();
  let crot = new THREE.Quaternion();

  let mpos = new THREE.Vector3();
  let mrot = new THREE.Quaternion();

  //
  // XR start
  //
  window.defDistance = -bs.radius * 2;
  renderer.xr.addEventListener( 'sessionstart', function ( event ) {
    renderer.setClearColor(new THREE.Color(0x000), 1);

    cpmatrix = camera.projectionMatrix.clone();
    cpos.copy(camera.position);
    crot.copy(camera.quaternion);
    fov = camera.fov;

    // Put model into view
    group.position.z = defDistance;

    // Switch off floor
    cb_DisplayFloor = document.getElementById("display_floor");
    cb_DisplayFloorStatus = cb_DisplayFloor.checked;
    if(cb_DisplayFloorStatus)
      cb_DisplayFloor.click();

    // gui_mesh.visible = true;
  });

  // 
  // XR end
  // 
  renderer.xr.addEventListener( 'sessionend', function ( event ) {
    renderer.setClearColor(new THREE.Color(0x000), 0);

    camera.projectionMatrix.copy(cpmatrix);
    camera.position.copy(cpos);
    camera.quaternion.copy(crot);
    camera.fov = fov;

    // Restore model's state
    group.position.set(0, 0, 0);
    group.scale.set(1, 1, 1);
    group.rotation.set(0, 0, 0);

    // Restore floor
    if(cb_DisplayFloorStatus)
      cb_DisplayFloor.click();

    window.onWindowResize();
    //gui_mesh.visible = false;
  });

  await initController();
}

//
// Enter XR
//
function enterXR() {
  vrButton.click();
}
window.enterXR = enterXR;

//
// Init controller
//
async function initController()
{
  // Init XR controller
  window.controller = renderer.xr.getController( 0 );
  // Grip 
  const controllerModelFactory = new XRControllerModelFactory();
  const controllerGrip1 = renderer.xr.getControllerGrip( 0 );
  controllerGrip1.add( controllerModelFactory.createControllerModel( controllerGrip1 ) );
  scene.add( controllerGrip1 );

  // Beam
  const beam_geom = new THREE.CylinderGeometry( 0.003, 0.005, 1, 4, 1, true);
  const textureLoader = new THREE.TextureLoader();
  const alpha = textureLoader.load('./modules/webxr/beam_alpha.png');
  const beam_mat = new THREE.MeshStandardMaterial({ transparent: true,
                                                    alphaMap:alpha,
                                                    lightMapIntensity:0,
                                                    opacity: 0.8,
                                                    color: beam_color,
                                                    // emissive: 0xffffff
                                                    alphaTest:0.01
                                                    });
  beam = new THREE.Mesh(beam_geom, beam_mat);
  beam.name = 'beam';
  beam.receiveShadow = false;

  // Alight beam to grip
  beam.rotateX(Math.PI / 2);
  beam.translateY(-0.5);
  controller.add(beam);
  scene.add( controller );

  // Hilight controller
  const light = new THREE.PointLight( 0xffffff, 2, 1, 0);
  light.position.set( 0, 0, 0 );
  scene.add( light );

  controller.addEventListener('connected', (e) => {
    controller.gamepad = e.data.gamepad;
  });
  controller.addEventListener( 'selectstart', onSelectStart );
  controller.addEventListener( 'selectend', onSelectEnd );
}

//
//  Controller events
//
function onSelectStart( event )
{
  // Hilight beam
  const controller = event.target;
  let beam = controller.getObjectByName( 'beam' );
  beam.material.color.set(beam_hilight_color);
  beam.material.emissive.g = 0.5;
  
  rotX = controller.rotation.x;
  rotY = controller.rotation.y;
  rotate = true;
}

function onSelectEnd( event )
{
  // Unhighlight beam
  const controller = event.target;
  beam = controller.getObjectByName( 'beam' );
  beam.material.color.set(beam_color);
  beam.material.emissive.g = 0;

  rotate = false;
}

export { initXR };
