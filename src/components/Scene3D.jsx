import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/* viren_CI.png 알파에서 추출한 정규화 윤곽선 (y는 아래 방향) */
const POLYS = [
  [[0.0293,-0.0012],[0.0138,0.006],[0.0043,0.0193],[-0.0009,0.0361],[0.0009,0.0627],[0.2647,0.7012],[0.2741,0.7193],[0.325,0.5976],[0.3267,0.588],[0.1371,0.1301],[0.3328,0.1289],[0.3371,0.1349],[0.5905,0.747],[0.5974,0.7639],[0.5974,0.7711],[0.5552,0.8687],[0.4405,0.8675],[0.4026,0.7759],[0.4009,0.7639],[0.475,0.588],[0.4767,0.5759],[0.4241,0.4518],[0.3043,0.7373],[0.2974,0.759],[0.2991,0.7831],[0.375,0.9687],[0.3845,0.9867],[0.3966,0.9964],[0.4034,0.9988],[0.5948,0.9988],[0.6086,0.9916],[0.625,0.9639],[0.7009,0.7807],[0.7043,0.7639],[0.3974,0.0217],[0.3862,0.006],[0.3707,-0.0012]],
  [[0.6241,-0.0012],[0.6138,0.0036],[0.6009,0.0193],[0.5181,0.2217],[0.7198,0.7108],[0.7259,0.7193],[0.9957,0.0675],[0.9991,0.0554],[0.9991,0.0361],[0.994,0.0193],[0.9845,0.006],[0.9707,-0.0012]],
]
const AR = 1159 / 830
const SIZE = 3.0

export default function Scene3D({ explode = true, cycleMaterials = false }) {
  const stageRef = useRef(null)

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !window.WebGLRenderingContext) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    stage.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
    camera.position.set(0, 0, 11.4) // 살짝 뒤로 — 로고 축소 + 회전 시 잘림 방지

    /* 환경맵 — 어두운 스튜디오에 옐로우 스트릭 */
    scene.environment = (() => {
      const cv = document.createElement('canvas')
      cv.width = 1024; cv.height = 512
      const g = cv.getContext('2d')
      const bg = g.createLinearGradient(0, 0, 0, 512)
      bg.addColorStop(0, '#050403'); bg.addColorStop(.45, '#1c1710')
      bg.addColorStop(.62, '#0d0a06'); bg.addColorStop(1, '#030201')
      g.fillStyle = bg; g.fillRect(0, 0, 1024, 512)
      g.save(); g.translate(250, 150); g.rotate(-.2); g.scale(1, .22)
      let w = g.createRadialGradient(0, 0, 0, 0, 0, 300)
      w.addColorStop(0, 'rgba(255,236,168,.95)'); w.addColorStop(.4, 'rgba(250,206,70,.7)')
      w.addColorStop(1, 'rgba(248,198,42,0)')
      g.fillStyle = w; g.beginPath(); g.arc(0, 0, 300, 0, 7); g.fill(); g.restore()
      g.save(); g.translate(680, 270); g.rotate(.16); g.scale(1, .17)
      let y = g.createRadialGradient(0, 0, 0, 0, 0, 360)
      y.addColorStop(0, 'rgba(255,224,120,1)'); y.addColorStop(.35, 'rgba(248,198,42,.85)')
      y.addColorStop(1, 'rgba(248,198,42,0)')
      g.fillStyle = y; g.beginPath(); g.arc(0, 0, 360, 0, 7); g.fill(); g.restore()

      const tex = new THREE.CanvasTexture(cv)
      tex.mapping = THREE.EquirectangularReflectionMapping
      const pmrem = new THREE.PMREMGenerator(renderer)
      const env = pmrem.fromEquirectangular(tex).texture
      pmrem.dispose(); tex.dispose()
      return env
    })()

    /* CI 윤곽선 → 압출 지오메트리 (스크롤 분할용 explode 셰이더) */
    const group = new THREE.Group()

    /* 스크롤 진행도(0→1) · 폭발 중심 — solid/wire 재질이 공유 */
    const uProgress = { value: 0 }
    const uCenter = { value: new THREE.Vector3() }

    /* 정점 셰이더에 면 단위 폭발(중심 밖으로 이동 + 개별 회전) 주입.
       + 프래그먼트 셰이더에 이동 거리 기반 알파 페이드 주입 → 멀리 흩어질수록 투명해진다. */
    const injectExplode = (shader) => {
      shader.uniforms.uProgress = uProgress
      shader.uniforms.uCenter = uCenter
      shader.vertexShader =
        'uniform float uProgress;\nuniform vec3 uCenter;\nattribute vec3 aCentroid;\nattribute float aRand;\nvarying float vExplode;\n' +
        shader.vertexShader
          .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
            { float p=uProgress; float a=p*(aRand-0.5)*7.0; float s=sin(a),c=cos(a);
              mat3 rn=mat3(c,0.,s, 0.,1.,0., -s,0.,c); objectNormal=rn*objectNormal; }`)
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            { vec3 d=normalize(aCentroid-uCenter+0.0001); float p=uProgress;
              float a=p*(aRand-0.5)*7.0; float s=sin(a),c=cos(a);
              mat3 r=mat3(c,0.,s, 0.,1.,0., -s,0.,c);
              vec3 lo=transformed-aCentroid; lo=r*lo;
              float disp=p*(0.6+aRand*1.4);
              transformed=aCentroid+lo+d*disp;
              vExplode=disp; }`)
      shader.fragmentShader =
        'varying float vExplode;\n' +
        shader.fragmentShader.replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
           gl_FragColor.a *= clamp(1.0 - vExplode * 0.62, 0.06, 1.0);`
        )
    }

    /* 분해되는 solid 조각 — 투명 활성화, 멀어질수록 셰이더가 알파를 낮춘다 */
    const solidMat = new THREE.MeshStandardMaterial({
      color: 0x100e0b, metalness: 1.0, roughness: 0.24, envMapIntensity: 1.5,
      transparent: true, depthWrite: true,
    })
    solidMat.onBeforeCompile = injectExplode

    /* 분할돼도 중앙에 유지되는 원본 CI 와이어프레임 (폭발 안 함) */
    const outlineMat = new THREE.LineBasicMaterial({ color: 0xf8c62a, transparent: true, opacity: 0 })

    /* 재질 순환(푸터, svz.io ref) — 절차적 범프(다공성) 텍스처 + 실제로 다른 finish들을
       단일 MeshPhysicalMaterial 속성으로 부드럽게 lerp. bump=표면 요철 세기. */
    const bumpTex = cycleMaterials ? (() => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 256
      const g = cv.getContext('2d')
      g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, 256, 256)
      for (let i = 0; i < 900; i++) {
        const x = Math.random() * 256, y = Math.random() * 256, rad = Math.random() * 9 + 1.5
        const v = (Math.random() * 255) | 0
        g.fillStyle = `rgb(${v},${v},${v})`
        g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill()
      }
      const tex = new THREE.CanvasTexture(cv)
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      tex.repeat.set(2.6, 2.6)
      return tex
    })() : null

    /* {색, 금속성, 거칠기, 투과, 이리데센스, 클리어코트, 범프세기, 환경광} */
    const presets = cycleMaterials ? [
      { c: 0x2a2a2a, m: 1, r: 0.35, tr: 0, ir: 0, cc: 0, bump: 0.45, env: 1.5 }, // 브러시드 다크메탈
      { c: 0xffffff, m: 1, r: 0.02, tr: 0, ir: 0, cc: 0, bump: 0, env: 2.0 },    // 미러 크롬
      { c: 0xcf3a2a, m: 0, r: 0.88, tr: 0, ir: 0, cc: 0, bump: 1.3, env: 0.35 }, // 매트 코랄(다공성)
      { c: 0xeaf2ff, m: 0, r: 0.05, tr: 1, ir: 0, cc: 0, bump: 0.06, env: 1.3 }, // 글래스
      { c: 0x0e0e0e, m: 1, r: 0.28, tr: 0, ir: 1, cc: 0, bump: 0.25, env: 1.5 }, // 이리데센트
      { c: 0xf8c62a, m: 0, r: 0.3, tr: 0, ir: 0, cc: 1, bump: 0.05, env: 1.2 },  // 클리어코트 옐로우(카페인트)
    ] : null
    const cycleMat = cycleMaterials ? new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(presets[0].c), metalness: presets[0].m, roughness: presets[0].r,
      transmission: 0.001, iridescence: 0.001, clearcoat: 0.001, // 셰이더 경로 유지용 tiny값 (recompile 방지)
      iridescenceIOR: 1.5, clearcoatRoughness: 0.2, ior: 1.45, thickness: 1.3,
      bumpMap: bumpTex, bumpScale: presets[0].bump, envMapIntensity: presets[0].env,
    }) : null
    const solidMeshes = []

    POLYS.forEach((pts) => {
      const shape = new THREE.Shape()
      pts.forEach(([px, py], i) => {
        const X = (px - .5) * AR * SIZE, Y = (.5 - py) * SIZE
        i ? shape.lineTo(X, Y) : shape.moveTo(X, Y)
      })
      shape.closePath()
      const baseGeo = new THREE.ExtrudeGeometry(shape, {
        depth: .52, bevelEnabled: true,
        bevelThickness: .028, bevelSize: .028, bevelSegments: 3, curveSegments: 1,
      })

      /* 원본 모양 외곽선 — 분할되는 조각과 별개로 항상 형태를 유지한다 */
      group.add(new THREE.LineSegments(new THREE.EdgesGeometry(baseGeo, 30), outlineMat))

      let geo = baseGeo.toNonIndexed()
      geo.computeVertexNormals()

      /* 삼각형별 중심 + 랜덤값 → 면 단위로 흩어지고 회전 */
      const pos = geo.attributes.position
      const n = pos.count
      const cen = new Float32Array(n * 3)
      const rnd = new Float32Array(n)
      for (let tri = 0; tri < n; tri += 3) {
        const cx = (pos.getX(tri) + pos.getX(tri + 1) + pos.getX(tri + 2)) / 3
        const cy = (pos.getY(tri) + pos.getY(tri + 1) + pos.getY(tri + 2)) / 3
        const cz = (pos.getZ(tri) + pos.getZ(tri + 1) + pos.getZ(tri + 2)) / 3
        const r = Math.random()
        for (let k = 0; k < 3; k++) {
          cen[(tri + k) * 3] = cx; cen[(tri + k) * 3 + 1] = cy; cen[(tri + k) * 3 + 2] = cz
          rnd[tri + k] = r
        }
      }
      geo.setAttribute('aCentroid', new THREE.BufferAttribute(cen, 3))
      geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1))

      const solid = new THREE.Mesh(geo, cycleMaterials ? cycleMat : solidMat)
      group.add(solid)
      solidMeshes.push(solid)
    })

    const box = new THREE.Box3().setFromObject(group)
    const ctr = box.getCenter(new THREE.Vector3())
    uCenter.value.copy(ctr)
    group.children.forEach((m) => m.position.sub(ctr))
    scene.add(group)

    scene.add(new THREE.AmbientLight(0xf8c62a, .1))
    const key = new THREE.DirectionalLight(0xffeaa6, 1.2); key.position.set(-4, 5, 6); scene.add(key)
    const warm = new THREE.PointLight(0xf8c62a, 26, 22); warm.position.set(2.6, .6, 2.6); scene.add(warm)
    const rim = new THREE.DirectionalLight(0xf0a81c, .45); rim.position.set(5, -3, -4); scene.add(rim)

    const resize = () => {
      const r = stage.getBoundingClientRect()
      const w = Math.max(1, r.width), h = Math.max(1, r.height)
      renderer.setSize(w, h, false)
      renderer.domElement.style.width = w + 'px'
      renderer.domElement.style.height = h + 'px'
      camera.aspect = w / h; camera.updateProjectionMatrix()
    }
    resize()
    const ro = window.ResizeObserver ? new ResizeObserver(resize) : null
    ro ? ro.observe(stage) : addEventListener('resize', resize)

    let tx = 0, ty = 0, mxr = 0, myr = 0
    let moveAcc = 0, matTarget = 0, lastX = null, lastY = null
    const _tmpCol = new THREE.Color()
    const onMove = (e) => {
      tx = (e.clientX / innerWidth - .5); ty = (e.clientY / innerHeight - .5)
      if (cycleMaterials) {
        if (lastX !== null) moveAcc += Math.hypot(e.clientX - lastX, e.clientY - lastY)
        lastX = e.clientX; lastY = e.clientY
        if (moveAcc > 240) { // 커서를 일정 거리 움직일 때마다 다음 재질을 '목표'로 (프레임에서 부드럽게 전환)
          moveAcc = 0
          matTarget = (matTarget + 1) % presets.length
        }
      }
    }
    addEventListener('mousemove', onMove)

    /* 스크롤 진행도 → 분할 정도. 히어로(0) → 약 1.2뷰포트 스크롤 시 완전 분할(1) */
    let targetP = 0, curP = 0
    const onScroll = () => {
      targetP = Math.min(1, Math.max(0, scrollY / (innerHeight * 1.2)))
      if (reduced) {
        curP = targetP
        uProgress.value = curP
        outlineMat.opacity = Math.min(0.5, curP * 0.85)
        renderer.render(scene, camera)
      }
    }
    /* explode=false면 스크롤 분해 없이 합쳐진 채로 유지 (푸터 배경용) */
    if (explode) {
      addEventListener('scroll', onScroll, { passive: true })
      onScroll()
    }

    let t = 0, spin = 0, raf
    const frame = () => {
      t += .0125
      curP += (targetP - curP) * 0.06
      uProgress.value = curP
      outlineMat.opacity = Math.min(0.5, curP * 0.85)
      spin += .0042 + curP * .004 // 분할될수록 회전이 살짝 빨라진다
      mxr += (tx - mxr) * .06; myr += (ty - myr) * .06

      if (cycleMaterials) {
        /* 재질 크로스페이드 — 목표 프리셋으로 속성을 매 프레임 lerp (0 근처는 tiny값 유지) */
        const p = presets[matTarget], k = 0.05
        cycleMat.color.lerp(_tmpCol.setHex(p.c), k)
        cycleMat.metalness += (p.m - cycleMat.metalness) * k
        cycleMat.roughness += (p.r - cycleMat.roughness) * k
        cycleMat.transmission += (Math.max(p.tr, 0.001) - cycleMat.transmission) * k
        cycleMat.iridescence += (Math.max(p.ir, 0.001) - cycleMat.iridescence) * k
        cycleMat.clearcoat += (Math.max(p.cc, 0.001) - cycleMat.clearcoat) * k
        cycleMat.bumpScale += (p.bump - cycleMat.bumpScale) * k
        cycleMat.envMapIntensity += (p.env - cycleMat.envMapIntensity) * k
        /* 커서를 따라다닌다 — 커서 위치로 이동 + 회전 (svz처럼) */
        group.rotation.y = mxr * 1.9 + Math.sin(t * .3) * .1
        group.rotation.x = -.06 + myr * 1.0 + Math.sin(t * .4) * .06
        group.rotation.z = mxr * .12
        group.position.x = mxr * 2.4
        group.position.y = -myr * 1.7 + Math.sin(t * .6) * .04
      } else {
        group.rotation.y = spin + mxr * 1.05
        group.rotation.x = -.16 + Math.sin(t * .55) * .1 + myr * .55
        group.rotation.z = Math.sin(t * .37) * .045
        group.position.y = Math.sin(t * .65) * .07
      }

      renderer.render(scene, camera)
      if (!reduced) raf = requestAnimationFrame(frame)
    }
    frame()
    stage.classList.add('live')

    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('mousemove', onMove)
      removeEventListener('scroll', onScroll)
      ro ? ro.disconnect() : removeEventListener('resize', resize)
      renderer.dispose()
      renderer.domElement.remove()
      stage.classList.remove('live')
    }
  }, [explode, cycleMaterials])

  return (
    <div className="stage" ref={stageRef}>
      <img className="fallback" src="/assets/viren_CI.png" alt="VIREN CI 마크" />
    </div>
  )
}
