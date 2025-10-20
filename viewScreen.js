//
// TODO
//
// - Restore camera position on XR exit
// - XR: Scale, rotate screen by controller (like in studio)
//
//
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AsyncLoader } from '/modules/AsyncLoader.js';
import { HTMLMesh } from '/modules/interactive/HTMLMesh.js';
import { InteractiveGroup } from '/modules/interactive/InteractiveGroup.js';
import { GUI } from '/node_modules/lil-gui/dist/lil-gui.esm.min.js';
import { XRControllerModelFactory } from '/modules/webxr/XRControllerModelFactory.js';
import { VRButton } from '/modules/webxr/VRButton.js';

let camera, cpmatrix;
let cpos = new THREE.Vector3();
let crot = new THREE.Quaternion();

let controls, gui, gui_mesh, scene, renderer, controller;
const FOV = 50;

let beam;  
const beam_color = 0xffffff;
const beam_hilight_color = 0x222222;
let param_changed = false;

let geometry1, material1, mesh1;
let geometry2, material2, mesh2;
let params = { scale: 1,
                rotate:  0,
                picture: 1 };

let textureLoader, texLeft, texRight;

function onReset() {
  controls.reset();
  param_changed = true; 
}

//
// View on screen
//
async function viewScreen(name) {
  console.log(name);  
  camera = new THREE.PerspectiveCamera( FOV, window.innerWidth / window.innerHeight, 0.1, 1000 );
  camera.layers.enable(1); // Render left view when no stereo available
  camera.position.set(0, 0, 1);

  scene = new THREE.Scene();
  // Init texture
  textureLoader = new THREE.TextureLoader();
  material1 = new THREE.MeshBasicMaterial();
  material2 = new THREE.MeshBasicMaterial();
  setPicture(1);

  // Environmant
  const envPath = "/data/textures/env/";
  const env = new THREE.CubeTextureLoader().load([
    envPath + "px.png",
    envPath + "nx.png",
    envPath + "py.png",
    envPath + "ny.png",
    envPath + "pz.png",
    envPath + "nz.png",
  ]);
  env.colorSpace = THREE.SRGBColorSpace;
  scene.background = env;
  scene.backgroundIntensity = 0.4;

  // const loader = new OBJLoader();
  let object = await AsyncLoader.loadOBJAsync("/data/textures/screen.obj");
  let model = object.children[0];

  // Left
  geometry1 = model.geometry;
  geometry1.scale( -1, 1, 1 );
  mesh1 = new THREE.Mesh( geometry1, material1 );
  mesh1.layers.set( 1 ); // Left eye only
  scene.add( mesh1 );
  // Right
  geometry2 = geometry1.clone();
  mesh2 = new THREE.Mesh( geometry2, material2 );
  mesh2.layers.set( 2 ); // Right eye only
  scene.add( mesh2 );

  // Renderer
  renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.setAnimationLoop( animate );

  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType( 'local' );

  // XR start 
  renderer.xr.addEventListener( 'sessionstart', function ( event ) {
    cpmatrix = camera.projectionMatrix.clone();
    cpos.copy(camera.position);
    crot.copy(camera.quaternion);

    gui.open();
    gui_mesh.visible = true;
  });

  // XR end
  renderer.xr.addEventListener( 'sessionend', function ( event ) {
    gui_mesh.visible = false;

    camera.projectionMatrix.copy(cpmatrix);
    camera.position.copy(cpos);
    camera.quaternion.copy(crot);
    camera.fov = FOV;
  });

  const container = document.getElementById( 'container' );
  container.appendChild( renderer.domElement );

  // GUI
  gui = new GUI( {width: 300, title:"Settings", closeFolders:false} );
  gui.add( params, 'scale', 0.1, 2, 0.01 ).name( 'Scale' ).onChange(()=>{ mesh2.scale.set(params.scale, params.scale, params.scale);
                                                                          mesh1.scale.set(params.scale, params.scale, params.scale); 
                                                                          param_changed = true; });
  gui.add( params, 'rotate',  0, 360, 1 ).name( 'Rotate'  ).onChange( ()=>{ const rad = THREE.MathUtils.degToRad(params.rotate);
                                                                            mesh2.rotation.y = mesh1.rotation.y = -rad; param_changed = true; }); 

  gui.add( params, 'picture',  1, 2, 1 ).name( 'Picture' ).onChange( ()=>{ setPicture(params.picture); param_changed = true; }); 

  gui.add( gui.reset(), 'reset' ).name( 'Reset' ).onChange(onReset);
  gui.open();

  const group = new InteractiveGroup( renderer, camera );
  scene.add( group );

  // GUI position
  gui_mesh = new HTMLMesh( gui.domElement );
  gui_mesh.rotation.x = -Math.PI / 9;
  gui_mesh.position.y = -0.47;
  gui_mesh.position.z = -0.6;
  group.add( gui_mesh );
  gui_mesh.visible = false;


  // Init XR controller
  controller = renderer.xr.getController( 0 );
  // Grip 
  const controllerModelFactory = new XRControllerModelFactory();
  const controllerGrip1 = renderer.xr.getControllerGrip( 0 );
  controllerGrip1.add( controllerModelFactory.createControllerModel( controllerGrip1 ) );
  scene.add( controllerGrip1 );

  // Beam
  const beam_geom = new THREE.CylinderGeometry( 0.003, 0.005, 1, 4, 1, true);
  const alpha = textureLoader.load('/data/textures/beam_alpha.png');
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

  controller.addEventListener( 'selectstart', onSelectStart );
  controller.addEventListener( 'selectend', onSelectEnd );

  // Orbit controls
  controls = new OrbitControls( camera, renderer.domElement );
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = false;
  controls.rotateSpeed *= -0.5;

  // VR Button
  document.body.appendChild( VRButton.createButton( renderer ) );
  window.addEventListener( 'resize', onWindowResize );
}
window.viewScreen = viewScreen;

// Set picture
function setPicture(picture) {
  if(picture == 1) {
    texLeft = textureLoader.load  ('/data/images/odsp_left1_s.png');
    texRight = textureLoader.load('/data/images/odsp_right1.png');
  } else {
    texLeft = textureLoader.load('/data/images/odsp_left2.png');
    texRight = textureLoader.load('/data/images/odsp_right2.png');
  }
  texLeft.colorSpace = THREE.SRGBColorSpace;
  material1.map = texLeft;
  material1.needsUpdate = true;

  texRight.colorSpace = THREE.SRGBColorSpace;
  material2.map = texRight;
  material2.needsUpdate = true;
}

//
//  Controller events
//
function onSelectStart( event )
{
  // Hilight beam
  const controller = event.target;
  beam = controller.getObjectByName( 'beam' );
  beam.material.color.set(beam_hilight_color);
  beam.material.emissive.g = 0.5;

  // TODO: Check it in XRView
  // param_changed = false;
}

function onSelectEnd( event )
{
  // Unhighlight beam
  const controller = event.target;
  beam = controller.getObjectByName( 'beam' );
  beam.material.color.set(beam_color);
  beam.material.emissive.g = 0;

  if(param_changed)
  {
    param_changed = false;
    return;
  }

  gui_mesh.visible = !gui_mesh.visible;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize( window.innerWidth, window.innerHeight );
}

function animate() {
  renderer.render( scene, camera );
}
